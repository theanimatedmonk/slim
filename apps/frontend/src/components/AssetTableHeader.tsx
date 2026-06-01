import { useEffect, useRef } from 'react';
import './AssetTableHeader.css';

interface Props {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onSelectAll: (checked: boolean) => void;
}

export default function AssetTableHeader({
  checked,
  indeterminate,
  disabled,
  onSelectAll,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = Boolean(indeterminate);
    }
  }, [indeterminate, checked]);

  return (
    <li className="asset-table-header">
      <span className="asset-table-header__col asset-table-header__col--select">
        <input
          ref={inputRef}
          type="checkbox"
          className="app-checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onSelectAll(e.target.checked)}
          aria-label="Select all files"
        />
      </span>
      <span className="asset-table-header__col asset-table-header__col--file">File</span>
      <span className="asset-table-header__col asset-table-header__col--size">Size</span>
      <span className="asset-table-header__col asset-table-header__col--actions">Actions</span>
    </li>
  );
}
