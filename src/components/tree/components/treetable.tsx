/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import './common.css';
import './treetable.css';

import { ConfigProvider, Table, TableColumnsType } from 'antd';
import { ColumnType, ExpandableConfig } from 'antd/es/table/interface';
import { default as React, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { CommandDefinition } from '../../../common';
import { getNestedValue } from '../../../common/utils';
import { CDTTreeItem, CDTTreeTableActionColumn, CDTTreeTableColumnDefinition, CDTTreeTableStringColumn, CTDTreeWebviewContext } from '../types';
import { allKeys, classNames, createHighlightedText, createLabelWithTooltip, filterTree } from './utils';
import { debounce } from 'throttle-debounce';
import { SearchOverlay } from './search-overlay';
import { TreeNavigator } from './treetable-navigator';
import { ExpandIcon } from './expand-icon';

/**
 * Component to render a tree table.
 */
export type ComponentTreeTableProps<T = unknown> = {
    /**
     * Information about the columns to be rendered.
     */
    columnDefinitions?: CDTTreeTableColumnDefinition[];
    /**
     * Data source to be rendered.
     */
    dataSource?: CDTTreeItem<T>[];
    /**
     * Function to sort the root elements of the data source.
     */
    dataSourceComparer?: (a: CDTTreeItem<T>, b: CDTTreeItem<T>) => number;
    /**
     * Configuration for the expansion of the tree table.
     */
    expansion?: {
        /**
         * List of expanded row keys.
         */
        expandedRowKeys?: string[];
        /**
         * Callback to be called when a row is expanded or collapsed.
         */
        onExpand?: ExpandableConfig<CDTTreeItem<unknown>>['onExpand'];
    },
    /**
     * Configuration for the pinning of the tree table.
     */
    pin?: {
        /**
         * List of pinned row keys.
         */
        pinnedRowKeys?: string[];
        /**
         * Callback to be called when a row is pinned or unpinned.
         */
        onPin?: (event: React.UIEvent, pinned: boolean, record: CDTTreeItem<unknown>) => void;
    }
    /**
     * Configuration for the actions of the tree table.
     */
    action?: {
        /**
         * Callback to be called when an action is triggered.
         */
        onAction?: (event: React.UIEvent, command: CommandDefinition, value: unknown, record: CDTTreeItem<unknown>) => void;
    }
};

interface BodyRowProps extends React.HTMLAttributes<HTMLDivElement> {
    'data-row-key': string;
}

const BodyRow = React.forwardRef<HTMLDivElement, BodyRowProps>((props, ref) => {
    // Support VSCode context menu items
    return (
        <div
            ref={ref}
            tabIndex={0}
            key={props['data-row-key']}
            {...props}
            {...CTDTreeWebviewContext.create({ webviewSection: 'tree-item', cdtTreeItemId: props['data-row-key'] })}
        />
    );
});

function useWindowSize() {
    const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
    useLayoutEffect(() => {
        const updateSize = debounce(100, () => {
            setSize({ width: window.innerWidth, height: window.innerHeight });
        });

        window.addEventListener('resize', updateSize);
        return () => {
            window.removeEventListener('resize', updateSize);
            updateSize.cancel();
        };
    }, []);

    return size;
}

export const AntDComponentTreeTable = <T,>(props: ComponentTreeTableProps<T>) => {
    const { width, height } = useWindowSize();
    const [globalSearchText, setGlobalSearchText] = useState<string | undefined>();
    const globalSearchRef = React.useRef<SearchOverlay>(null);
    const autoSelectRowRef = React.useRef<boolean>(false);

    const ref = React.useRef<HTMLDivElement | null>(null);
    const tblRef: Parameters<typeof Table>[0]['ref'] = React.useRef(null);

    // ==== Data ====

    const filteredData = useMemo(() => {
        let data = props.dataSource ?? [];
        if (globalSearchText) {
            data = filterTree(data, globalSearchText);
        }
        if (props.dataSourceComparer) {
            data = [...data].sort(props.dataSourceComparer);
        }
        return data;
    }, [props.dataSource, props.dataSourceComparer, globalSearchText]);

    // ==== Search ====

    const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            e.stopPropagation();
            globalSearchRef.current?.show();
        }
    }, []);

    const onSearchShow = useCallback(() => setGlobalSearchText(globalSearchRef.current?.value()), []);
    const onSearchHide = useCallback(() => {
        setGlobalSearchText(undefined);
        autoSelectRowRef.current = true;
    }, [autoSelectRowRef]);
    const onSearchChange = useMemo(() => debounce(300, (text: string) => setGlobalSearchText(text)), []);

    // ==== Selection ====

    const [selection, setSelection] = useState<CDTTreeItem>();

    const selectRow = useCallback((record: CDTTreeItem) => {
        // Single select only
        if (selection?.key !== record.key) {
            setSelection(record);
        }
    }, [selection]);

    // ==== Expansion ====

    const expandedRowKeys = useMemo(() => {
        if (globalSearchText) {
            // on search expand all nodes as they match the search
            return allKeys(filteredData);
        }
        // otherwise use the expandedRowKeys from the props but ensure that the selected element is also expanded
        const expanded = props.expansion?.expandedRowKeys ?? [];
        if (autoSelectRowRef.current && selection) {
            let selectionParent = selection.parent;
            while (selectionParent) {
                expanded.push(selectionParent.key);
                selectionParent = selectionParent.parent;
            }
        }
        return expanded;
    }, [filteredData, globalSearchText, props.expansion?.expandedRowKeys, selection, autoSelectRowRef.current]);


    const handleExpand = useCallback(
        (expanded: boolean, record: CDTTreeItem) => {
            props.expansion?.onExpand?.(expanded, record);
        },
        [props.expansion?.onExpand]
    );

    // ==== Index ====

    const dataSourceIndex = useMemo(() => {
        const rowIndex = new Map<string, number>();
        const keyIndex = new Map<string, CDTTreeItem>();

        let currentIndex = 0;

        const traverse = (nodes: CDTTreeItem[]) => {
            nodes.forEach(node => {
                rowIndex.set(node.id, currentIndex++);
                keyIndex.set(node.key, node);

                if (node.children && node.children.length > 0 && expandedRowKeys.includes(node.id)) {
                    traverse(node.children);
                }
            });
        };

        traverse(filteredData ?? []);
        return {
            rowIndex,
            keyIndex
        };
    }, [filteredData, expandedRowKeys]);

    // ==== Navigation ====

    const navigator = React.useMemo(() => new TreeNavigator({
        ref,
        rowIndex: dataSourceIndex.rowIndex,
        expandedRowKeys,
        expand: handleExpand,
        select: selectRow
    }), [ref, dataSourceIndex.rowIndex, expandedRowKeys, handleExpand, selectRow]);

    const onTableKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
        const selectedKey = selection?.key;
        if (!selectedKey) {
            return;
        }

        const record = dataSourceIndex.keyIndex.get(selectedKey);
        if (!record) {
            return;
        }

        switch (event.key) {
            case 'ArrowDown': {
                navigator.next(record);
                break;
            }
            case 'ArrowUp': {
                navigator.previous(record);
                break;
            }
            case 'ArrowLeft': {
                navigator.collapse(record);
                break;
            }
            case 'ArrowRight': {
                navigator.expand(record);
                break;
            }
            case 'Enter': {
                navigator.toggle(record);
                break;
            }
            case ' ': {
                navigator.toggle(record);
                break;
            }
            case 'PageUp': {
                navigator.previousPage();
                break;
            }
            case 'PageDown': {
                navigator.nextPage();
                break;
            }
        }
    }, [selection, dataSourceIndex]);

    // ==== Renderers ====

    const renderStringColumn = useCallback(
        (label: string, item: CDTTreeItem<unknown>, columnDef: CDTTreeTableStringColumn) => {
            const icon = columnDef.icon ? <i className={classNames('cell-icon', columnDef.icon)}></i> : null;
            let content = createHighlightedText(label, columnDef.highlight);

            if (columnDef.tooltip) {
                content = createLabelWithTooltip(<span>{content}</span>, columnDef.tooltip);
            }

            return (
                <div className='tree-cell ant-table-cell-ellipsis' tabIndex={0}>
                    {icon}
                    {content}
                </div>
            );
        },
        []
    );

    const renderActionColumn = useCallback(
        (column: CDTTreeTableActionColumn | undefined, record: CDTTreeItem<unknown>) => {
            const actions: React.ReactNode[] = [];

            if (record.pinned !== undefined) {
                actions.push(
                    <i
                        key={record.pinned ? 'unpin' : 'pin'}
                        title={record.pinned ? 'Unpin row' : 'Pin row'}
                        className={`codicon ${record.pinned ? 'codicon-pin' : 'codicon-pinned'}`}
                        onClick={(event) => props.pin?.onPin?.(event, !record.pinned, record)}
                        aria-label={record.pinned ? 'Unpin row' : 'Pin row'}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => { if (event.key === 'Enter') props.pin?.onPin?.(event, !record.pinned, record); }}
                    ></i>
                );
            }

            if (column?.commands) {
                column.commands.forEach((command) => {
                    actions.push(
                        <i
                            key={command.commandId}
                            title={command.title}
                            className={`codicon codicon-${command.icon}`}
                            onClick={(event) => props.action?.onAction?.(event, command, command.value, record)}
                            aria-label={command.title}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => { if (event.key === 'Enter') props.action?.onAction?.(event, command, command.value, record); }}
                        ></i>
                    );
                });
            }

            return <div className={'tree-actions'}>{actions}</div>;
        },
        [props.pin, props.action]
    );

    // ==== Columns ====

    const createColumns = (columnDefinitions: CDTTreeTableColumnDefinition[]): TableColumnsType<CDTTreeItem> => {
        function stringColumn(def: CDTTreeTableColumnDefinition): ColumnType<CDTTreeItem> {
            return {
                title: def.field,
                dataIndex: ['columns', def.field, 'label'],
                width: 0,
                ellipsis: true,
                render: (label, record) => renderStringColumn(label, record, getNestedValue<CDTTreeTableStringColumn>(record, ['columns', def.field]))
            };
        }

        function actionColumn(def: CDTTreeTableColumnDefinition): ColumnType<CDTTreeItem> {
            return {
                title: def.field,
                dataIndex: ['columns', def.field],
                width: 64,
                render: renderActionColumn
            };
        }

        return [
            ...(columnDefinitions?.map(c => {
                if (c.type === 'string') {
                    return stringColumn(c);
                } else if (c.type === 'action') {
                    return actionColumn(c);
                }

                return {
                    title: c.field,
                    dataIndex: ['columns', c.field, 'label'],
                    width: 200
                };
            }) ?? [])
        ];
    };

    const columns = useMemo(() => createColumns(props.columnDefinitions ?? []), [props.columnDefinitions]);

    // ==== Handlers ====

    // Ensure that even if we lose the active element through scrolling or other means, we can still navigate by restoring the focus
    useEffect(() => {
        if (!ref.current) {
            return;
        }

        const observer = new MutationObserver(() => {
            if (document.activeElement === globalSearchRef.current?.input()) {
                // do not steal focus from the search input
                return;
            }
            const selectedRow = document.querySelector<HTMLElement>('.ant-table-row-selected');
            if (!selectedRow) {
                // Selected row was removed from the DOM, focus on the table
                ref.current?.focus();
            } else if (selectedRow !== document.activeElement) {
                // Selected row is still in the DOM, but not focused
                selectedRow?.focus();
            }
        });

        observer.observe(ref.current, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, [ref.current]);

    // Abort scrolling when mouse drag was finished (e.g., left mouse button is no longer pressed) outside the iframe
    useEffect(() => {
        const abortScroll = (event: MouseEvent) => {
            if (!(event.buttons & 1)) {
                // left button is no longer pressed...
                const elements = document.getElementsByClassName('ant-table-tbody-virtual-scrollbar-thumb-moving');
                if (elements.length > 0) {
                    // ...but we are still scrolling the thumb (left button was released outside iframe) -> abort scrolling
                    window.dispatchEvent(new MouseEvent('mouseup'));
                }
            }
        };
        document.addEventListener('mouseenter', abortScroll);
        return () => document.removeEventListener('mouseenter', abortScroll);
    }, []);

    // Scroll to selected row if autoSelectRowRef is set
    useEffect(() => {
        if (autoSelectRowRef.current && selection) {
            tblRef.current?.scrollTo({ key: selection.key });
            autoSelectRowRef.current = false;
        }
    }, [autoSelectRowRef.current]);

    const onRowClick = useCallback(
        (record: CDTTreeItem, event: React.MouseEvent<HTMLElement>) => {
            const isExpanded = expandedRowKeys?.includes(record.id);
            handleExpand(!isExpanded, record);
            selectRow(record);

            event.currentTarget.focus();
        },
        [props.expansion]
    );

    // ==== Return ====

    return <div onKeyDown={onKeyDown}>
        <SearchOverlay key={'search'} ref={globalSearchRef} onHide={onSearchHide} onShow={onSearchShow} onChange={onSearchChange} />
        <ConfigProvider
            theme={{
                cssVar: true,
                hashed: false
            }}
            renderEmpty={() => <div className={'empty-message'}>No data available.</div>}
        >
            <div ref={ref}
                tabIndex={-1}
                style={{ outline: 'none' }}
                onKeyDown={onTableKeyDown}
            >
                <Table<CDTTreeItem>
                    ref={tblRef}
                    columns={columns}
                    dataSource={filteredData}
                    components={{ body: { row: BodyRow } }}
                    virtual
                    scroll={{ x: width, y: height - 2 }}
                    showHeader={false}
                    pagination={false}
                    rowClassName={(record) => classNames({ 'ant-table-row-selected': record.key === selection?.key })}
                    onRow={(record) => ({
                        onClick: (event) => onRowClick(record, event),
                    })}
                    expandable={{
                        expandIcon: props => <ExpandIcon {...props} />,
                        showExpandColumn: true,
                        expandedRowKeys: expandedRowKeys,
                        onExpand: handleExpand
                    }}
                />
            </div>
        </ConfigProvider>
    </div>;
};
