type FilterOption<T extends string> = {
  value: T;
  label: string;
};

type FilterPillsProps<T extends string> = {
  options: Array<FilterOption<T>>;
  value: T;
  onChange: (next: T) => void;
};

export function FilterPills<T extends string>({ options, value, onChange }: FilterPillsProps<T>) {
  return (
    <div className="-mx-1 overflow-x-auto pb-1">
      <div className="flex min-w-max gap-2 px-1">
        {options.map((option) => {
          const active = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`app-pill whitespace-nowrap ${active ? "app-pill--active" : ""}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
