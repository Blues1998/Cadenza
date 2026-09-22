import React from 'react';

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '');
const CMD = MAC ? '⌘' : 'Ctrl';

const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="keycap">{children}</kbd>
);

interface Row { keys: React.ReactNode; what: string }

const GROUPS: { name: string; where?: string; rows: Row[] }[] = [
  {
    name: 'Anywhere',
    rows: [
      { keys: <><Key>{CMD}</Key><Key>K</Key></>, what: 'Jump to a screen, a song or a drill' },
      { keys: <Key>Space</Key>, what: 'Start and stop whatever this screen plays' },
      { keys: <Key>?</Key>, what: 'This list' },
      { keys: <Key>Esc</Key>, what: 'Close what is open' }
    ]
  },
  {
    name: 'Guitar mode',
    where: 'Theory · Physics',
    rows: [
      { keys: <><Key>1</Key>…<Key>8</Key></>, what: 'Hold a chord shape — C G D A E Am Em Dm' },
      { keys: <><Key>Z</Key><Key>X</Key><Key>C</Key><Key>V</Key><Key>B</Key><Key>N</Key></>, what: 'Pick a string, low to high — sweep them for a strum' }
    ]
  },
  {
    name: 'Keyboard as an instrument',
    where: 'Theory · Song Hero',
    rows: [
      { keys: <><Key>A</Key><Key>S</Key><Key>D</Key><Key>F</Key><Key>G</Key><Key>H</Key><Key>J</Key><Key>K</Key></>, what: 'White keys, A being the root' },
      { keys: <><Key>W</Key><Key>E</Key><Key>T</Key><Key>Y</Key><Key>U</Key></>, what: 'The black keys between them' }
    ]
  }
];

/**
 * The keys, written down.
 *
 * The app has had a keyboard guitar and a keyboard piano in it for as long as
 * it has had a Theory page, and nothing anywhere said so — a shortcut nobody
 * can discover is a shortcut nobody has. One key opens the list, and the list
 * says which key opened it.
 */
export const KeySheet: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="overlay" onMouseDown={onClose} role="presentation">
    <div className="keysheet" onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div className="keysheet-head">
        <h3>Keys</h3>
        <button type="button" className="keysheet-shut" onClick={onClose} aria-label="Close">×</button>
      </div>
      {GROUPS.map(group => (
        <section key={group.name} className="keysheet-group">
          <span className="surface-label">
            {group.name}
            {group.where && <span className="readout keysheet-where">{group.where}</span>}
          </span>
          <dl className="keysheet-rows">
            {group.rows.map(row => (
              <div key={row.what}>
                <dt>{row.keys}</dt>
                <dd>{row.what}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  </div>
);

export default KeySheet;
