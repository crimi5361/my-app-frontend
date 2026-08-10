import { useEffect, useState } from 'react';
import { Button, Input, Select, Space } from 'antd';
import { SearchOutlined, FilterFilled } from '@ant-design/icons';

const ACTIVE_COLOR = 'var(--ant-color-primary, #1677ff)';

/**
 * Filtres intégrés à l'en-tête des colonnes, façon DataGrid (Excel / Material UI DataGrid / Ant
 * Design Table) — chaque colonne porte son propre filtre, totalement indépendant des autres :
 * aucun n'exige de choisir un autre filtre au préalable, aucun n'en réinitialise un autre.
 * Ne fait que produire les props `filterDropdown`/`filterIcon`/`filtered` d'une colonne antd ; le
 * state (EtudiantFiltersValue), buildFiltersQuery et fetchData restent inchangés côté page.
 */

interface TextFilterDropdownProps {
  value: string;
  onSearch: (v: string) => void;
  placeholder: string;
  close: () => void;
}

const TextFilterDropdown = ({ value, onSearch, placeholder, close }: TextFilterDropdownProps) => {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);

  return (
    <div style={{ padding: 8, width: 220 }}>
      <Input
        autoFocus
        placeholder={placeholder}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onPressEnter={() => { onSearch(local); close(); }}
        style={{ marginBottom: 8, display: 'block' }}
      />
      <Space>
        <Button type="primary" size="small" icon={<SearchOutlined />} onClick={() => { onSearch(local); close(); }}>
          Rechercher
        </Button>
        <Button size="small" onClick={() => { setLocal(''); onSearch(''); close(); }}>
          Réinitialiser
        </Button>
      </Space>
    </div>
  );
};

export function getTextColumnFilterProps(opts: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const { value, onChange, placeholder } = opts;
  return {
    filterIcon: () => <SearchOutlined style={{ color: value ? ACTIVE_COLOR : undefined }} />,
    filtered: Boolean(value),
    filterDropdown: ({ close }: { close: () => void }) => (
      <TextFilterDropdown value={value} onSearch={onChange} placeholder={placeholder} close={close} />
    ),
  };
}

export interface SelectFilterOption {
  label: string;
  value: number | string;
}

export interface SelectFieldConfig {
  value?: number | string;
  onChange: (v: number | string | undefined) => void;
  options: SelectFilterOption[];
  placeholder: string;
  loading?: boolean;
}

const isActive = (v: number | string | undefined) => v !== undefined && v !== '';

/** Une colonne = un Select autonome, jamais désactivé, jamais réinitialisé par une autre colonne. */
export function getSelectColumnFilterProps(field: SelectFieldConfig) {
  return {
    filterIcon: () => <FilterFilled style={{ color: isActive(field.value) ? ACTIVE_COLOR : undefined }} />,
    filtered: isActive(field.value),
    filterDropdown: ({ close }: { close: () => void }) => (
      <div style={{ padding: 8, width: 240 }}>
        <Select
          autoFocus
          style={{ width: '100%' }}
          placeholder={field.placeholder}
          value={field.value}
          onChange={(v) => { field.onChange(v); close(); }}
          loading={field.loading}
          allowClear
          showSearch
          optionFilterProp="label"
          options={field.options}
        />
      </div>
    ),
  };
}
