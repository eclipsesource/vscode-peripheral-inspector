/********************************************************************************
 * Copyright (C) 2024 Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import { Dropdown, DropdownChangeEvent, DropdownProps } from 'primereact/dropdown';
import { SelectItem } from 'primereact/selectitem';
import React from 'react';
import { CDTTreeItem, CDTTreeTableColumn, EditableEnumData } from '../types';
import { EditableComponentProps, EditableComponentRef, AsEditable, AsTreeTableCell } from './TreeTableCell';
import './enum-cell.css';
import { ChevronDownIcon } from 'primereact/icons/chevrondown';

export interface EnumCellProps extends EditableComponentProps {
    row: CDTTreeItem;
    cell: CDTTreeTableColumn;
    data: EditableEnumData;
}

export type FooterProps = DropdownProps & { focusedOptionIndex?: number };

const EnumCellComponent = React.forwardRef<EditableComponentRef, EnumCellProps>(({ row, data, ...props }, ref) => {
    const [options] = React.useState<SelectItem[]>(data.options.map(option => ({ label: option.value, title: option.detail })));
    const dropdownRef = React.useRef<Dropdown>(null);

    React.useImperativeHandle(ref, () => ({
        focus: () => dropdownRef.current?.focus()
    }));

    const onChange = (event: DropdownChangeEvent) => {
        const item = event.value as SelectItem;
        if (item.label) {
            props.onSubmitValue(item.label);
        }
    };

    const onKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            props.onCancelEdit();
        }
    };

    const detailPanel = (params: DropdownProps) => {
        const props = params as FooterProps;
        const detail = options[props?.focusedOptionIndex ?? - 1]?.title;
        return detail;
    };

    const onBlur = () => {
        if (!dropdownRef.current?.getOverlay()?.contains(document.activeElement) && !dropdownRef.current?.getElement()?.contains(document.activeElement)) {
            // focus lost and overlay/popup is not visible
            // props.onCancelEdit();
        }
    };

    return <Dropdown
        ref={dropdownRef}
        options={options}
        className='enum-cell vscode-dropdown'
        id={`${row.id}-enum-field`}
        value={options.find(option => option.label === data.value)}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onClick={event => event.stopPropagation()}
        onBlur={onBlur}
        onHide={props.onCancelEdit}
        panelFooterTemplate={detailPanel}
        dropdownIcon={(opts) => { return <ChevronDownIcon {...opts.iconProps} ref={null} scale={0.7} />; }}
    />;
});

export const EnumCell = AsEditable(AsTreeTableCell(EnumCellComponent));
