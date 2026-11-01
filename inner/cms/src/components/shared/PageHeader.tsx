import React from 'react';

/**
 * The header of Payload's collection lists – title, small actions beside it,
 * actions on the right, a description below – in its own markup and classes,
 * so it looks the same. (`ListHeader` from @payloadcms/ui is the collection
 * version and needs a collection.)
 */
export function PageHeader({
  title,
  titleActions = [],
  actions = [],
  after,
}: {
  title: string;
  titleActions?: React.ReactNode[];
  actions?: React.ReactNode[];
  after?: React.ReactNode;
}) {
  return (
    <header className="list-header">
      <div className="list-header__content">
        <div className="list-header__title-and-actions">
          <h1 className="list-header__title">{title}</h1>
          {titleActions.length > 0 && <div className="list-header__title-actions">{titleActions}</div>}
        </div>
        {actions.length > 0 && <div className="list-header__actions">{actions}</div>}
      </div>
      {after && <div className="list-header__after-header-content">{after}</div>}
    </header>
  );
}
