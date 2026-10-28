import { crc32 } from 'node:zlib';

/**
 * A ZIP file written as a stream, for the host's "Download CVs"
 * (endpoints/share.ts). The files go in as they are, uncompressed – PDFs are
 * compressed already – and each is read only when its turn comes, so a whole
 * evening's CVs never sit in memory at once. Names are UTF-8 (flag bit 11).
 * No ZIP64: fine below 4 GB and 65,535 files.
 */

export type ZipEntry = {
  name: string;
  size: number;
  modified: Date;
  read: () => Promise<Uint8Array>;
};

const UTF8 = 0x0800;
const nameOf = (e: ZipEntry) => Buffer.from(e.name, 'utf8');

const berlin = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
});

/** MS-DOS date and time, in the hosts' (German) local time – ZIP has no time zones. */
function dosTime(d: Date): { time: number; date: number } {
  const p = Object.fromEntries(berlin.formatToParts(d).map((x) => [x.type, Number(x.value)]));
  return {
    time: (p.hour << 11) | (p.minute << 5) | (p.second >> 1),
    date: (Math.max(p.year - 1980, 0) << 9) | (p.month << 5) | p.day,
  };
}

/** The archive's exact length, for Content-Length – known before any file is read. */
export const zipSize = (entries: ZipEntry[]) =>
  entries.reduce((sum, e) => sum + 30 + 46 + 2 * nameOf(e).length + e.size, 22);

export function zipStream(entries: ZipEntry[]): ReadableStream<Uint8Array> {
  const central: Buffer[] = [];
  let offset = 0;
  let i = 0;
  return new ReadableStream({
    async pull(controller) {
      if (i === entries.length) {
        const dir = Buffer.concat(central);
        const end = Buffer.alloc(22);
        end.writeUInt32LE(0x06054b50, 0);
        end.writeUInt16LE(entries.length, 8);
        end.writeUInt16LE(entries.length, 10);
        end.writeUInt32LE(dir.length, 12);
        end.writeUInt32LE(offset, 16);
        controller.enqueue(dir);
        controller.enqueue(end);
        controller.close();
        return;
      }
      const e = entries[i++];
      const data = await e.read();
      // The length went out in Content-Length already; a file that changed since is an error, not a short archive.
      if (data.length !== e.size) throw new Error(`zip: ${e.name} is ${data.length} bytes, expected ${e.size}`);
      const name = nameOf(e);
      const crc = crc32(data);
      const { time, date } = dosTime(e.modified);

      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4);
      local.writeUInt16LE(UTF8, 6);
      local.writeUInt16LE(time, 10);
      local.writeUInt16LE(date, 12);
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(data.length, 18);
      local.writeUInt32LE(data.length, 22);
      local.writeUInt16LE(name.length, 26);

      const head = Buffer.alloc(46);
      head.writeUInt32LE(0x02014b50, 0);
      head.writeUInt16LE(20, 4);
      head.writeUInt16LE(20, 6);
      head.writeUInt16LE(UTF8, 8);
      head.writeUInt16LE(time, 12);
      head.writeUInt16LE(date, 14);
      head.writeUInt32LE(crc, 16);
      head.writeUInt32LE(data.length, 20);
      head.writeUInt32LE(data.length, 24);
      head.writeUInt16LE(name.length, 28);
      head.writeUInt32LE(offset, 42);
      central.push(head, name);

      controller.enqueue(local);
      controller.enqueue(name);
      controller.enqueue(data);
      offset += 30 + name.length + data.length;
    },
  });
}
