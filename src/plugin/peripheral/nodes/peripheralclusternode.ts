/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { PeripheralBaseNode, ClusterOrRegisterBaseNode, PERIPHERAL_ID_SEP, PeripheralTreeItem } from './basenode';
import { PeripheralRegisterNode } from './peripheralregisternode';
import { PeripheralNode } from './peripheralnode';
import { AddrRange } from '../../../addrranges';
import { AccessType, ClusterOptions, EnumerationMap } from '../../../api-types';
import { NumberFormat, NodeSetting } from '../../../common';
import { hexFormat } from '../../../utils';
import { CDTTreeItem } from '../../../components/tree/types';

export type PeripheralOrClusterNode = PeripheralNode | PeripheralClusterNode;
export type PeripheralRegisterOrClusterNode = PeripheralRegisterNode | PeripheralClusterNode;

export class PeripheralClusterNode extends ClusterOrRegisterBaseNode {
    private children: PeripheralRegisterOrClusterNode[];
    public readonly name: string;
    public readonly description?: string;
    public readonly offset: number;
    public readonly size: number;
    public readonly resetValue: number;
    public readonly accessType: AccessType;

    constructor(public parent: PeripheralOrClusterNode, options: ClusterOptions) {
        super(parent);
        this.name = options.name;
        this.description = options.description;
        this.offset = options.addressOffset;
        this.accessType = options.accessType || AccessType.ReadWrite;
        this.size = options.size || parent.size;
        this.resetValue = options.resetValue || parent.resetValue;
        this.children = [];
        this.parent.addChild(this);

        options.clusters?.forEach((clusterOptions) => {
            // PeripheralClusterNode constructor already adding the reference as child to parent object (PeripheralClusterNode object)
            new PeripheralClusterNode(this, clusterOptions);
        });

        options.registers?.forEach((registerOptions) => {
            // PeripheralRegisterNode constructor already adding the reference as child to parent object (PeripheralClusterNode object)
            new PeripheralRegisterNode(this, registerOptions);
        });
    }

    public getLabel(): string {
        return `${this.getLabelTitle()} [${this.getLabelValue()}]`;
    }

    public getLabelTitle(): string {
        return this.name;
    }

    public getLabelValue(): string {
        return hexFormat(this.offset, 0);
    }

    public getContextValue(): string {
        return 'cluster';
    }

    public getTreeItem(): vscode.TreeItem | Promise<vscode.TreeItem> {
        const label = this.getLabel();

        const item = new vscode.TreeItem(label, this.expanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed);
        item.id = this.getId();
        item.contextValue = this.getContextValue();
        item.tooltip = this.description || undefined;

        return item;
    }

    public getCDTTreeItem(): PeripheralTreeItem {
        return PeripheralTreeItem.create({
            id: this.getId(),
            key: this.getId(),
            expanded: this.expanded,
            label: this.getLabel(),
            path: this.getId().split(PERIPHERAL_ID_SEP),
            options: {
                commands: this.getCommands(),
                contextValue: this.getContextValue(),
                tooltip: this.description,
            },
            columns: {
                'title': {
                    value: this.getLabelTitle(),
                    tooltip: this.description,
                },
                'value': {
                    value: this.getLabelValue(),
                    tooltip: this.getLabelValue()
                }
            }
        });
    }

    public getChildren(): PeripheralRegisterOrClusterNode[] {
        return this.children;
    }

    public setChildren(children: PeripheralRegisterOrClusterNode[]): void {
        this.children = children.slice(0, children.length);
        this.children.sort((c1, c2) => c1.offset > c2.offset ? 1 : -1);
    }

    public addChild(child: PeripheralRegisterOrClusterNode): void {
        this.children.push(child);
        this.children.sort((c1, c2) => c1.offset > c2.offset ? 1 : -1);
    }

    public getBytes(offset: number, size: number): Uint8Array {
        return this.parent.getBytes(this.offset + offset, size);
    }

    public getAddress(offset: number): number {
        return this.parent.getAddress(this.offset + offset);
    }

    public getOffset(offset: number): number {
        return this.parent.getOffset(this.offset + offset);
    }

    public getFormat(): NumberFormat {
        if (this.format !== NumberFormat.Auto) {
            return this.format;
        } else {
            return this.parent.getFormat();
        }
    }

    public async updateData(): Promise<boolean> {
        await Promise.all(this.children.map((r) => r.updateData()));
        return true;
    }

    public saveState(path: string): NodeSetting[] {
        const results: NodeSetting[] = [];

        if (this.format !== NumberFormat.Auto || this.expanded) {
            results.push({ node: `${path}.${this.name}`, expanded: this.expanded, format: this.format });
        }

        this.children.forEach((c) => {
            results.push(...c.saveState(`${path}.${this.name}`));
        });

        return results;
    }

    public findByPath(path: string[]): PeripheralBaseNode | undefined {
        if (path.length === 0) {
            return this;
        } else {
            const child = this.children.find((c) => c.name === path[0]);
            if (child) {
                return child.findByPath(path.slice(1));
            } else {
                return undefined;
            }
        }
    }

    public collectRanges(ary: AddrRange[]): void {
        this.children.map((r) => { r.collectRanges(ary); });
    }

    public getPeripheral(): PeripheralBaseNode {
        return this.parent.getPeripheral();
    }

    public getCopyValue(): string {
        throw new Error('Method not implemented.');
    }

    public performUpdate(): Promise<boolean> {
        throw new Error('Method not implemented.');
    }

    public resolveDeferedEnums(enumTypeValuesMap: { [key: string]: EnumerationMap; }) {
        for (const child of this.children) {
            child.resolveDeferedEnums(enumTypeValuesMap);
        }
    }
}
