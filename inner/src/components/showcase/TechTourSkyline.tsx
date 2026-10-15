'use client';
import React, { useId } from 'react';

/**
 * The Munich skyline the tour's line runs down through: Neues Rathaus,
 * Frauenkirche, Olympiaturm and the Olympiastadion's tent roof, drawn as ink
 * outlines on the page's paper and filled with ASCII art – rows of `#%@` for
 * the walls, `:-:` for the windows, lighter characters where the light catches
 * a tower. A city made of code, for a club called Coding for Change. Parts too
 * narrow for those characters (finials, pinnacles, the mast) get the same ones
 * set finer, so that everything inside an outline is ASCII.
 *
 * Every landmark is drawn once, in its own coordinates – origin on the ground
 * at its left edge (the Olympiaturm: at its axis), y running up into the
 * negative – and placed twice: a wide panorama with the line through its
 * middle, and a narrow one for phones, where the line runs down the left edge
 * and the city stands to its right (with the Highlight Towers instead of the
 * Rathaus and the stadium, which need more width than a phone has).
 *
 * The characters are SVG patterns (`TILES`), one tile per kind of shading,
 * set in the site's monospace. Each tile is opaque – paper first, then the
 * characters – so a building in front hides the one behind it instead of
 * letting its outline show between the letters. The line itself is not part
 * of the drawing: it is the page's own rail (`.tt-route__line` in techtour.css), laid
 * over the top with a halo of paper that cuts the ground line where it passes.
 */

interface Paint {
    /** `url(#…)` of the dense ASCII, unique per drawing. */
    fill: string;
    /** `url(#…)` of the light ASCII, for where the light catches a tower. */
    light: string;
    /** `url(#…)` of the dense ASCII set small, for the narrow parts. */
    fine: string;
}

/** The light that runs down a tower: the same rows, in lighter characters. */
const Glint: React.FC<{ paint: Paint; x: number; y: number; w: number; h: number }> = ({
    paint,
    x,
    y,
    w,
    h,
}) => <rect className="tt-sky__glint" x={x} y={y} width={w} height={h} fill={paint.light} />;

/**
 * The tip a dome or a spire ends in, as one silhouette: a neck, a bulb and a
 * needle, standing on (x, y). Filled with the fine ASCII, like every other
 * part of the drawing that narrow.
 */
const Finial: React.FC<{ fill: string; x: number; y: number; s?: number }> = ({
    fill,
    x,
    y,
    s = 1,
}) => (
    <path
        fill={fill}
        d={`M${x - 2.5 * s} ${y}V${y - 7 * s}C${x - 6.5 * s} ${y - 8 * s} ${x - 6.5 * s} ${
            y - 17 * s
        } ${x - 1.3 * s} ${y - 19 * s}L${x} ${y - 38 * s}L${x + 1.3 * s} ${
            y - 19 * s
        }C${x + 6.5 * s} ${y - 17 * s} ${x + 6.5 * s} ${y - 8 * s} ${x + 2.5 * s} ${
            y - 7 * s
        }V${y}Z`}
    />
);

/** A small pointed pinnacle on a roofline, `w` wide and `h` tall, standing on (x, y). */
const Pinnacle: React.FC<{ fill: string; x: number; y: number; w: number; h: number }> = ({
    fill,
    x,
    y,
    w,
    h,
}) => (
    <path
        fill={fill}
        d={`M${x - w / 2} ${y}V${y - h * 0.3}L${x} ${y - h}L${x + w / 2} ${y - h * 0.3}V${y}Z`}
    />
);

/** Neues Rathaus, Marienplatz. 292 wide, 281 to the tip of the tower. */
const Rathaus: React.FC<Paint> = (paint) => {
    const { fill, fine } = paint;
    return (
        <g>
            <rect x={18} y={-94} width={257} height={94} fill={fill} />
            <polygon points="24,-94 24,-110 48.5,-141 73,-110 73,-94" fill={fill} />
            <polygon points="219,-94 219,-110 243.5,-141 268,-110 268,-94" fill={fill} />
            {[84, 102, 119, 173, 190, 207].map((x) => (
                <Pinnacle key={x} fill={fine} x={x} y={-94} w={6} h={15} />
            ))}
            <polygon points="1,0 1,-126 9.5,-142 18,-126 18,0" fill={fill} />
            <polygon points="275,0 275,-126 283,-142 291,-126 291,0" fill={fill} />
            <path className="tt-sky__detail" d="M18 -64H129M162 -64H275M18 -33H129M162 -33H275" />
            <rect x={129} y={-168} width={33} height={168} fill={fill} />
            <Glint paint={paint} x={141} y={-168} w={8} h={168} />
            <rect x={126} y={-178} width={39} height={10} fill={fill} />
            <rect x={129} y={-210} width={33} height={32} fill={fill} />
            <Glint paint={paint} x={141} y={-210} w={8} h={32} />
            <polygon points="131,-210 145.5,-262 160,-210" fill={fill} />
            <Pinnacle fill={fine} x={129} y={-210} w={6} h={19} />
            <Pinnacle fill={fine} x={162} y={-210} w={6} h={19} />
            <Finial fill={fine} x={145.5} y={-259} s={0.55} />
        </g>
    );
};

/**
 * One of the Frauenkirche's two towers, `x` its left edge: the shaft, a ring,
 * and the onion dome – taller than it is wide, swelling just past the ring
 * and drawing in to the finial.
 */
const ChurchTower: React.FC<{ paint: Paint; x: number }> = ({ paint, x }) => {
    const { fill } = paint;
    const c = x + 23;
    return (
        <g>
            <rect x={x} y={-243} width={46} height={243} fill={fill} />
            <Glint paint={paint} x={x + 20} y={-243} w={8} h={243} />
            <rect x={c - 25} y={-247} width={50} height={4} fill={fill} />
            <path
                d={`M${c - 24} -247C${c - 28} -263 ${c - 25} -284 ${c - 13} -296C${c - 7} -301 ${
                    c - 4
                } -305 ${c - 2.5} -308H${c + 2.5}C${c + 4} -305 ${c + 7} -301 ${c + 13} -296C${
                    c + 25
                } -284 ${c + 28} -263 ${c + 24} -247Z`}
                fill={fill}
            />
            <Finial fill={paint.fine} x={c} y={-308} />
        </g>
    );
};

/** Frauenkirche: the nave, and the two towers in front of it. 241 wide. */
const Frauenkirche: React.FC<Paint> = (paint) => (
    <g>
        <polygon points="0,0 0,-83 64,-120 176,-120 241,-83 241,0" fill={paint.fill} />
        <polygon points="110,-120 110,-140 120,-151 130,-140 130,-120" fill={paint.fill} />
        <ChurchTower paint={paint} x={64} />
        <ChurchTower paint={paint} x={130} />
    </g>
);

/** Olympiaturm, drawn about its own axis: the stepped basket and the mast. */
const Olympiaturm: React.FC<Paint> = (paint) => {
    const { fill } = paint;
    return (
        <g>
            <polygon points="-14.5,0 -10,-241 10,-241 14.5,0" fill={fill} />
            <Glint paint={paint} x={-2} y={-241} w={6} h={241} />
            <polygon
                points="-17,-241 -17,-255 -27.5,-255 -27.5,-265 -36,-265 -36,-283 -27.5,-283 -27.5,-293 -15,-293 -15,-299 15,-299 15,-293 27.5,-293 27.5,-283 36,-283 36,-265 27.5,-265 27.5,-255 17,-255 17,-241"
                fill={fill}
            />
            <path className="tt-sky__detail" d="M-27.5 -265H27.5M-27.5 -283H27.5M-17 -255H17M-15 -293H15" />
            <path fill={paint.fine} d="M-4 -299V-331H-2V-358L0 -364L2 -358V-331H4V-299Z" />
        </g>
    );
};

/**
 * Olympiastadion: the bowl, the tent roof, and the masts it hangs from. 455
 * wide. Every cable ends where it holds something – on the roof's upper edge
 * (points on its curves) or on the ground – never in mid-air.
 */
const Olympiastadion: React.FC<Paint> = ({ fill, fine }) => (
    <g>
        <polygon points="0,0 17.7,-23.8 442,-23.8 454.8,0" fill={fill} />
        <path
            d="M17.7 -54C45 -100 70 -135 96 -135C125 -135 140 -94.5 167 -94.5C200 -94.5 220 -160 248 -160C278 -160 292 -102 318 -102C345 -102 352 -130 374 -130C400 -130 420 -90 440 -59L440 -46.5C420 -75 400 -94.5 374 -94.5C352 -94.5 345 -77 318 -77C292 -77 278 -117 248 -117C220 -117 200 -69 167 -69C140 -69 125 -99.6 96 -99.6C70 -99.6 45 -65 17.7 -39Z"
            fill={fill}
        />
        <path
            className="tt-sky__cable"
            d="M50.6 -208L5 0M50.6 -208L96 -135M50.6 -208L119 -126.3M213.8 -238.5L192 0M213.8 -238.5L248 -160M213.8 -238.5L271.4 -147.5M408.4 -198L454.8 0M408.4 -198L374 -130M408.4 -198L350.2 -118.1"
        />
        <polygon points="62.7,-21 68.7,-21 53.6,-208 47.6,-208" fill={fill} />
        <polygon points="219.4,-21 225.4,-21 216.8,-238.5 210.8,-238.5" fill={fill} />
        <polygon points="391.2,-21 397.2,-21 411.4,-198 405.4,-198" fill={fill} />
        <circle fill={fine} cx={50.6} cy={-208} r={2.6} />
        <circle fill={fine} cx={213.8} cy={-238.5} r={2.6} />
        <circle fill={fine} cx={408.4} cy={-198} r={2.6} />
    </g>
);

/** Highlight Towers, Schwabing: two slabs and the bridges between them. 134 wide. */
const HighlightTowers: React.FC<Paint> = (paint) => {
    const { fill } = paint;
    return (
        <g>
            <rect x={60} y={-206} width={12} height={13} fill={fill} />
            <rect x={60} y={-92} width={12} height={13} fill={fill} />
            <rect x={0} y={-298} width={60} height={298} fill={fill} />
            <Glint paint={paint} x={24} y={-298} w={10} h={298} />
            <rect x={-3} y={-304} width={66} height={6} fill={fill} />
            <rect x={72} y={-267} width={62} height={267} fill={fill} />
            <Glint paint={paint} x={97} y={-267} w={10} h={267} />
            <rect x={69} y={-273} width={68} height={6} fill={fill} />
        </g>
    );
};

/**
 * The town around the landmarks: low blocks and gabled houses, drawn faint.
 * `[x, width, height, roof]` on the ground line; a roof is a gable that high.
 */
type House = [number, number, number, number];
const Town: React.FC<{ fill: string; houses: House[] }> = ({ fill, houses }) => (
    <g className="tt-sky__town">
        {houses.map(([x, w, h, roof]) => (
            <polygon
                key={x}
                fill={fill}
                points={
                    roof > 0
                        ? `${x},0 ${x},${-h} ${x + w / 2},${-h - roof} ${x + w},${-h} ${x + w},0`
                        : `${x},0 ${x},${-h} ${x + w},${-h} ${x + w},0`
                }
            />
        ))}
    </g>
);

/**
 * The ASCII, one tile per kind of shading: `ink` for walls and roofs, with a
 * column of `:-:` windows every eight characters; `light` for where the light
 * catches a tower; `town` for the houses behind, in pale ink. (`fine`, below,
 * is `ink` again at `FINE` of the size.)
 */
const TILES = {
    ink: [
        '#%#@#%##%#@#%##%#@#%##%#',
        '%#%##%#@%#%##%#@%#%##%#@',
        '#%#:-:#%#%#:-:#%#%#:-:#%',
    ],
    light: [':-:.:-:.:-:.', '.:-.:-.:-.:-'],
    town: ['=-=-=:=-=-=:', '-=:=-=-=:=-='],
} as const;
/** A character cell, in the drawing's units: Roboto Mono's advance (0.6 em of
 *  6.5) and a line set solid, so the rows read as shading. */
const CHAR_W = 3.9;
const LINE = 6;
/** How much smaller the narrow parts' characters are set. */
const FINE = 0.45;

/**
 * The tiles as patterns. `scale` sizes the characters for a drawing whose
 * landmarks are placed scaled down (the narrow one), so the letters come out
 * the same size on the screen; `townScale` does the same for its houses,
 * which are not scaled.
 */
const Patterns: React.FC<{ id: string; scale?: number; townScale?: number }> = ({
    id,
    scale = 1,
    townScale = 1,
}) => {
    const kinds = [
        { kind: 'ink', rows: TILES.ink, s: scale },
        { kind: 'light', rows: TILES.light, s: scale },
        { kind: 'town', rows: TILES.town, s: townScale },
        { kind: 'fine', rows: TILES.ink, s: scale * FINE },
    ];
    return (
        <defs>
            {kinds.map(({ kind, rows, s }) => {
                const w = rows[0].length * CHAR_W;
                const h = rows.length * LINE;
                return (
                    <pattern
                        key={kind}
                        id={`${id}-${kind}`}
                        width={w}
                        height={h}
                        patternUnits="userSpaceOnUse"
                        patternTransform={s === 1 ? undefined : `scale(${s})`}
                    >
                        <rect className="tt-sky__paper" width={w} height={h} />
                        {rows.map((row, i) => (
                            <text
                                key={i}
                                className={`tt-sky__chars tt-sky__chars--${kind}`}
                                x={0}
                                y={(i + 1) * LINE - 1.2}
                                textLength={w}
                                lengthAdjust="spacing"
                            >
                                {row}
                            </text>
                        ))}
                    </pattern>
                );
            })}
        </defs>
    );
};

/** The wide panorama: 1440 across, the line at 720, the ground at 370. */
const WIDE_TOWN: House[] = [
    [-330, 80, 30, 0], [-250, 90, 44, 14], [-160, 80, 30, 0], [-80, 80, 40, 0],
    [0, 53, 34, 14], [345, 26, 46, 0], [371, 20, 30, 10], [632, 40, 30, 0],
    [672, 36, 22, 12], [737, 52, 36, 0], [789, 40, 26, 14], [873, 48, 44, 0],
    [921, 40, 30, 0], [1000, 70, 60, 0], [1072, 92, 82, 12], [1166, 72, 64, 16],
    [1240, 82, 54, 0], [1324, 64, 40, 12], [1390, 66, 48, 0], [1458, 84, 34, 14],
    [1544, 92, 50, 0], [1638, 76, 30, 0], [1716, 90, 42, 12],
];

/**
 * The narrow one: 375 across, the line at the left edge, the ground at 226. A
 * phone shows just that; a wider screen sees on past its right edge, so the
 * town – and the stadium – carry on beyond it.
 */
const NARROW_TOWN: House[] = [
    [-60, 60, 24, 0], [0, 34, 22, 0], [34, 38, 16, 8], [217, 30, 28, 10],
    [247, 22, 18, 0], [333, 50, 26, 0], [383, 40, 30, 10], [690, 50, 34, 0],
    [740, 44, 24, 12], [784, 60, 30, 0], [844, 50, 38, 12],
];

const TechTourSkyline: React.FC = () => {
    const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
    const wide = `tt-sky-w${uid}`;
    const narrow = `tt-sky-n${uid}`;
    const paint = (id: string): Paint => ({
        fill: `url(#${id}-ink)`,
        light: `url(#${id}-light)`,
        fine: `url(#${id}-fine)`,
    });
    const wideInk = paint(wide);
    const narrowInk = paint(narrow);
    return (
        <div className="tt-sky" aria-hidden="true">
            <svg
                className="tt-sky__svg tt-sky__svg--wide"
                viewBox="0 0 1440 372"
                preserveAspectRatio="xMidYMax meet"
                focusable="false"
            >
                <Patterns id={wide} />
                <g transform="translate(0 370)">
                    <Town fill={`url(#${wide}-town)`} houses={WIDE_TOWN} />
                    <g className="tt-sky__ink">
                        <g transform="translate(53 0)">
                            <Rathaus {...wideInk} />
                        </g>
                        <g transform="translate(391 0)">
                            <Frauenkirche {...wideInk} />
                        </g>
                        <g transform="translate(856 0)">
                            <Olympiaturm {...wideInk} />
                        </g>
                        <g transform="translate(952 0)">
                            <Olympiastadion {...wideInk} />
                        </g>
                    </g>
                    <path className="tt-sky__ground" d="M-1200 0.5H2640" />
                </g>
            </svg>
            <svg
                className="tt-sky__svg tt-sky__svg--narrow"
                viewBox="0 0 375 230"
                preserveAspectRatio="xMinYMax meet"
                focusable="false"
            >
                {/* The landmarks are placed at 0.6, so their characters are set
                    at 1/0.6 to come out the size of the wide drawing's – a
                    little smaller still (0.8), since the whole is smaller. */}
                <Patterns id={narrow} scale={1.33} townScale={0.8} />
                <g transform="translate(0 226)">
                    <Town fill={`url(#${narrow}-town)`} houses={NARROW_TOWN} />
                    <g className="tt-sky__ink">
                        <g transform="translate(72 0) scale(0.6)">
                            <Frauenkirche {...narrowInk} />
                        </g>
                        <g transform="translate(271 0) scale(0.6)">
                            <Olympiaturm {...narrowInk} />
                        </g>
                        <g transform="translate(298 0) scale(0.6)">
                            <HighlightTowers {...narrowInk} />
                        </g>
                        <g transform="translate(420 0) scale(0.6)">
                            <Olympiastadion {...narrowInk} />
                        </g>
                    </g>
                    <path className="tt-sky__ground" d="M-400 0.5H1400" />
                </g>
            </svg>
        </div>
    );
};

export default TechTourSkyline;
