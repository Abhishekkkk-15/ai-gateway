import React, { useMemo } from 'react';
import Select, {
  components,
  type Props as SelectProps,
  type GroupBase,
  type DropdownIndicatorProps,
  type ClearIndicatorProps,
  type MultiValueRemoveProps,
  type MenuProps,
  type MenuListProps,
  type StylesConfig,
  type ClassNamesConfig,
} from 'react-select';
import CreatableSelect, {
  type CreatableProps,
} from 'react-select/creatable';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '../../lib/utils.js';

export interface SelectOption<T = string> {
  label: string;
  value: T;
  description?: string;
  badge?: string;
  icon?: React.ComponentType<{ className?: string }>;
  [key: string]: unknown;
}

export interface BaseCustomSelectProps<
  Option = SelectOption,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>
> {
  className?: string;
  portalMenu?: boolean;
  size?: 'default' | 'sm';
  onValueChange?: (value: any) => void;
  classNames?: ClassNamesConfig<Option, IsMulti, Group>;
  styles?: StylesConfig<Option, IsMulti, Group>;
}

export type ReactSelectProps<
  Option = SelectOption,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>
> = (
  | ({ creatable?: false } & Omit<SelectProps<Option, IsMulti, Group>, 'value'>)
  | ({ creatable: true } & Omit<CreatableProps<Option, IsMulti, Group>, 'value'>)
) & {
  value?: any;
} & BaseCustomSelectProps<Option, IsMulti, Group>;

// Custom Dropdown Indicator
function CustomDropdownIndicator<
  Option,
  IsMulti extends boolean,
  Group extends GroupBase<Option>
>(props: DropdownIndicatorProps<Option, IsMulti, Group>) {
  return (
    <components.DropdownIndicator {...props}>
      <ChevronDown
        className={cn(
          'size-3.5 text-muted-foreground transition-transform duration-200',
          props.selectProps.menuIsOpen && 'rotate-180 text-foreground'
        )}
      />
    </components.DropdownIndicator>
  );
}

// Custom Clear Indicator
function CustomClearIndicator<
  Option,
  IsMulti extends boolean,
  Group extends GroupBase<Option>
>(props: ClearIndicatorProps<Option, IsMulti, Group>) {
  return (
    <components.ClearIndicator {...props}>
      <X className="size-3.5 text-muted-foreground hover:text-foreground transition-colors" />
    </components.ClearIndicator>
  );
}

// Custom Multi Value Remove Button
function CustomMultiValueRemove<
  Option,
  IsMulti extends boolean,
  Group extends GroupBase<Option>
>(props: MultiValueRemoveProps<Option, IsMulti, Group>) {
  return (
    <components.MultiValueRemove {...props}>
      <X className="size-3 text-muted-foreground hover:text-foreground transition-colors" />
    </components.MultiValueRemove>
  );
}

// Custom Menu Container with Event Isolation
function CustomMenu<
  Option,
  IsMulti extends boolean,
  Group extends GroupBase<Option>
>(props: MenuProps<Option, IsMulti, Group>) {
  return (
    <components.Menu
      {...props}
      innerProps={{
        ...props.innerProps,
        onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
          e.stopPropagation();
          props.innerProps?.onPointerDown?.(e);
        },
        onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => {
          e.stopPropagation();
          props.innerProps?.onMouseDown?.(e);
        },
        onTouchStart: (e: React.TouchEvent<HTMLDivElement>) => {
          e.stopPropagation();
          props.innerProps?.onTouchStart?.(e);
        },
        onWheel: (e: React.WheelEvent<HTMLDivElement>) => {
          e.stopPropagation();
          props.innerProps?.onWheel?.(e);
        },
      }}
    />
  );
}

// Custom MenuList Container with Scroll Isolation
function CustomMenuList<
  Option,
  IsMulti extends boolean,
  Group extends GroupBase<Option>
>(props: MenuListProps<Option, IsMulti, Group>) {
  return (
    <components.MenuList
      {...props}
      innerProps={{
        ...props.innerProps,
        onWheel: (e: React.WheelEvent<HTMLDivElement>) => {
          e.stopPropagation();
          props.innerProps?.onWheel?.(e);
        },
        onTouchMove: (e: React.TouchEvent<HTMLDivElement>) => {
          e.stopPropagation();
          props.innerProps?.onTouchMove?.(e);
        },
      }}
    />
  );
}

export function ReactSelect<
  Option = SelectOption,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>
>(props: ReactSelectProps<Option, IsMulti, Group>) {
  const {
    creatable = false,
    className,
    portalMenu = false,
    size = 'default',
    value,
    onChange,
    onValueChange,
    classNames,
    styles,
    components: userComponents,
    menuPlacement = 'auto',
    menuShouldScrollIntoView = false,
    ...rest
  } = props;

  // Resolve primitive values (e.g. value="chat" or value={10}) to matching option objects
  const resolvedValue = useMemo(() => {
    if (value === undefined) {
      return undefined;
    }
    if (value === null || value === '') {
      return null;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const valStr = String(value);
      const flat = (props.options as any[]) || [];
      for (const item of flat) {
        if (item && 'options' in item && Array.isArray(item.options)) {
          const found = item.options.find((opt: any) => String(opt.value) === valStr);
          if (found) return found;
        } else if (item && String(item.value) === valStr) {
          return item;
        }
      }
      return { label: valStr, value };
    }
    return value;
  }, [value, props.options]);

  const valueProps = value !== undefined ? { value: resolvedValue } : {};

  const handleChange = (selected: any, actionMeta: any) => {
    if (onChange) {
      onChange(selected, actionMeta);
    }
    if (onValueChange) {
      if (Array.isArray(selected)) {
        onValueChange(selected.map((s: any) => s.value));
      } else {
        onValueChange(selected ? selected.value : undefined);
      }
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mergedClassNames: ClassNamesConfig<Option, IsMulti, Group> = {
    control: (state) =>
      cn(
        'flex w-full rounded-md border border-input bg-background text-xs shadow-sm transition-colors',
        size === 'sm' ? 'min-h-8 px-2 py-0.5' : 'min-h-9 px-2.5 py-1',
        state.isFocused
          ? 'ring-1 ring-ring border-ring'
          : 'hover:border-input/80',
        state.isDisabled && 'cursor-not-allowed opacity-50 bg-muted/40',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof classNames?.control === 'function' ? classNames.control(state) : (classNames?.control as any)
      ),
    valueContainer: (state) =>
      cn(
        'flex flex-wrap items-center gap-1.5 py-0.5',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof classNames?.valueContainer === 'function' ? classNames.valueContainer(state) : (classNames?.valueContainer as any)
      ),
    placeholder: (state) =>
      cn(
        'text-muted-foreground font-sans text-xs select-none',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof classNames?.placeholder === 'function' ? classNames.placeholder(state) : (classNames?.placeholder as any)
      ),
    input: (state) =>
      cn(
        'text-foreground font-sans text-xs',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof classNames?.input === 'function' ? classNames.input(state) : (classNames?.input as any)
      ),
    singleValue: (state) =>
      cn(
        'text-foreground font-sans text-xs font-medium',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof classNames?.singleValue === 'function' ? classNames.singleValue(state) : (classNames?.singleValue as any)
      ),
    multiValue: (state) =>
      cn(
        'inline-flex items-center gap-1 rounded bg-secondary/80 border border-border/60 px-2 py-0.5 text-xs font-medium text-secondary-foreground shadow-none',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof classNames?.multiValue === 'function' ? classNames.multiValue(state) : (classNames?.multiValue as any)
      ),
    multiValueLabel: (state) =>
      cn(
        'text-xs font-sans',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof classNames?.multiValueLabel === 'function' ? classNames.multiValueLabel(state) : (classNames?.multiValueLabel as any)
      ),
    multiValueRemove: (state) =>
      cn(
        'rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof classNames?.multiValueRemove === 'function' ? classNames.multiValueRemove(state) : (classNames?.multiValueRemove as any)
      ),
    menu: (state) =>
      cn(
        'z-50 mt-1 max-h-64 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg animate-in fade-in-80 pointer-events-auto',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof classNames?.menu === 'function' ? classNames.menu(state) : (classNames?.menu as any)
      ),
    menuList: (state) =>
      cn(
        'p-1 overflow-y-auto max-h-60 custom-scrollbar text-xs pointer-events-auto',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof classNames?.menuList === 'function' ? classNames.menuList(state) : (classNames?.menuList as any)
      ),
    option: (state) =>
      cn(
        'relative flex cursor-pointer select-none items-center justify-between rounded-sm px-2.5 py-1.5 text-xs outline-none transition-colors font-sans pointer-events-auto',
        state.isSelected
          ? 'bg-primary text-primary-foreground font-medium'
          : state.isFocused
          ? 'bg-accent text-accent-foreground'
          : 'text-popover-foreground',
        state.isDisabled && 'pointer-events-none opacity-50',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof classNames?.option === 'function' ? classNames.option(state) : (classNames?.option as any)
      ),
    group: (state) =>
      cn(
        'py-1',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof classNames?.group === 'function' ? classNames.group(state) : (classNames?.group as any)
      ),
    groupHeading: (state) =>
      cn(
        'px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof classNames?.groupHeading === 'function' ? classNames.groupHeading(state) : (classNames?.groupHeading as any)
      ),
    indicatorsContainer: (state) =>
      cn(
        'flex items-center gap-1',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof classNames?.indicatorsContainer === 'function' ? classNames.indicatorsContainer(state) : (classNames?.indicatorsContainer as any)
      ),
    clearIndicator: (state) =>
      cn(
        'p-1 cursor-pointer text-muted-foreground hover:text-foreground rounded',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof classNames?.clearIndicator === 'function' ? classNames.clearIndicator(state) : (classNames?.clearIndicator as any)
      ),
    dropdownIndicator: (state) =>
      cn(
        'p-1 cursor-pointer text-muted-foreground hover:text-foreground',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof classNames?.dropdownIndicator === 'function' ? classNames.dropdownIndicator(state) : (classNames?.dropdownIndicator as any)
      ),
    indicatorSeparator: (state) =>
      cn(
        'bg-border my-1 w-px',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof classNames?.indicatorSeparator === 'function' ? classNames.indicatorSeparator(state) : (classNames?.indicatorSeparator as any)
      ),
    noOptionsMessage: (state) =>
      cn(
        'p-3 text-center text-xs text-muted-foreground font-sans',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof classNames?.noOptionsMessage === 'function' ? classNames.noOptionsMessage(state) : (classNames?.noOptionsMessage as any)
      ),
    loadingMessage: (state) =>
      cn(
        'p-3 text-center text-xs text-muted-foreground font-sans',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof classNames?.loadingMessage === 'function' ? classNames.loadingMessage(state) : (classNames?.loadingMessage as any)
      ),
  };

  const mergedComponents = {
    DropdownIndicator: CustomDropdownIndicator,
    ClearIndicator: CustomClearIndicator,
    MultiValueRemove: CustomMultiValueRemove,
    Menu: CustomMenu,
    MenuList: CustomMenuList,
    ...userComponents,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mergedStyles: StylesConfig<Option, IsMulti, Group> = {
    ...styles,
    menuPortal: (base, state) => ({
      ...base,
      zIndex: 9999,
      pointerEvents: 'auto',
      ...(styles?.menuPortal ? styles.menuPortal(base, state) : {}),
    }),
  };

  const portalProps = portalMenu && typeof document !== 'undefined'
    ? {
        menuPortalTarget: document.body,
        menuPosition: 'fixed' as const,
        styles: mergedStyles,
      }
    : { styles };

  if (creatable) {
    return (
      <CreatableSelect<Option, IsMulti, Group>
        unstyled
        className={cn('w-full', className)}
        classNames={mergedClassNames}
        components={mergedComponents as never}
        menuPlacement={menuPlacement}
        menuShouldScrollIntoView={menuShouldScrollIntoView}
        {...valueProps}
        onChange={handleChange}
        {...portalProps}
        {...(rest as any)}
      />
    );
  }

  return (
    <Select<Option, IsMulti, Group>
      unstyled
      className={cn('w-full', className)}
      classNames={mergedClassNames}
      components={mergedComponents as never}
      menuPlacement={menuPlacement}
      menuShouldScrollIntoView={menuShouldScrollIntoView}
      {...valueProps}
      onChange={handleChange}
      {...portalProps}
      {...(rest as any)}
    />
  );
}
