/*********************************************************************
 * Copyright (c) 2024 Arm Limited and others
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *********************************************************************/

import './inplace-edit.css';

import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';
import React, { useState } from 'react';
import { CDTTreeTableTextEditColumn } from '../types';
import { createHighlightedText, createLabelWithTooltip } from './utils';

const KEY_CHANGE_VALUE = [
    'Enter'
];

const KEY_UNSELECT = [
    'ArrowUp',
    'ArrowDown',
    'PageDown',
    'PageUp',
    'Escape'
];

export type ComponentInPlaceEditProps = {
    id: string;
    column: CDTTreeTableTextEditColumn;
    onValueChanged(key: string, value: string): void;
};

export const ComponentInPlaceEdit = (props: ComponentInPlaceEditProps) => {
    // TODO: isEditMode should automatically switch to false on blur
    const [isEditMode, setEditMode] = useState(false);

    let view: React.JSX.Element;

    if (!isEditMode) {
        const enableEdit: React.MouseEventHandler = (event) => {
            event.stopPropagation();
            setEditMode(true);
        };
        const text = createHighlightedText(props.column.label, props.column.highlight);

        view = <div className='edit-label' onClick={enableEdit}>{createLabelWithTooltip(text, props.column.tooltip)}</div>;
    } else {
        const onKeyDown = (event: React.KeyboardEvent) => {
            event.stopPropagation();

            if (KEY_CHANGE_VALUE.includes(event.key)) {
                const element = event.currentTarget as HTMLInputElement;
                props.onValueChanged(element.id, element.value);
                setEditMode(false);
            }
            if (KEY_UNSELECT.includes(event.key)) {
                setEditMode(false);
            }
        };

        // TODO: Auto Focus doesn't work
        view = <VSCodeTextField
            id={`${props.id}-text-field`}
            initialValue={props.column.label}
            value={props.column.label}
            onKeyDown={event => onKeyDown(event)}
            onClick={event => event.stopPropagation()}
        />;
    }

    return <div
        className='inplace-edit'
    >{view}</div>;
};
