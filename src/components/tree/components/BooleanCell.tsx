/********************************************************************************
 * Copyright (C) 2024 Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import { ReactWrapperProps } from '@microsoft/fast-react-wrapper';
import { Checkbox } from '@vscode/webview-ui-toolkit';
import { VSCodeCheckbox } from '@vscode/webview-ui-toolkit/react';
import React from 'react';
import { CDTTreeItem, CDTTreeTableColumn, EditableBooleanData } from '../types';
import { AsEditable, AsTreeTableCell, EditableComponentProps, EditableComponentRef } from './TreeTableCell';
import './boolean-cell.css';

export type VSCodeCheckboxComponent = React.Component<ReactWrapperProps<Checkbox, { onChange: unknown; onInput: unknown; }>, unknown, unknown> & Checkbox;

export interface BooleanCellProps extends EditableComponentProps {
    row: CDTTreeItem;
    cell: CDTTreeTableColumn;
    data: EditableBooleanData;
}

const BooleanCellComponent = React.forwardRef<EditableComponentRef, BooleanCellProps>(({ row, data, ...props }, ref) => {
    const checkboxRef = React.useRef<VSCodeCheckboxComponent>(null);

    React.useImperativeHandle(ref, () => ({
        focus: () => checkboxRef.current?.focus()
    }));

    const onChange = () => {
        const value = checkboxRef.current?.checked ? '1' : '0';
        props.onSubmitValue(value);
    };

    const onKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            props.onCancelEdit();
        }
    };

    const onBlur = () => {
        props.onCancelEdit();
    };

    return <VSCodeCheckbox
        ref={checkboxRef}
        className='boolean-cell'
        id={`${row.id}-boolean-field`}
        checked={data.value === '1'}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onClick={event => event.stopPropagation()}
        onBlur={onBlur}
    />;
});

export const BooleanCell = AsEditable(AsTreeTableCell(BooleanCellComponent));
