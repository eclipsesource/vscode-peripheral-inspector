/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { PERIPHERAL_ID_SEP, PeripheralBaseNode, PeripheralTreeItem } from './basenode';
import { AddrRange } from '../../../addrranges';
import { NodeSetting } from '../../../common';

export class MessageNode extends PeripheralBaseNode {

    constructor(public message: string, public tooltip?: string | vscode.MarkdownString) {
        super();
    }

    public getId(): string {
        return 'message';
    }

    public getChildren(): PeripheralBaseNode[] | Promise<PeripheralBaseNode[]> {
        return [];
    }

    public getTreeItem(): vscode.TreeItem | Promise<vscode.TreeItem> {
        const ti = new vscode.TreeItem(this.getTitle(), vscode.TreeItemCollapsibleState.None);
        if (this.tooltip) { // A null crashes VSCode Tree renderer
            ti.tooltip = this.tooltip;
        }
        return ti;
    }

    public getCDTTreeItem(): PeripheralTreeItem {
        return PeripheralTreeItem.create({
            id: this.getId(),
            key: this.getId(),
            path: this.getId().split(PERIPHERAL_ID_SEP),
        });
    }

    public getTitle(): string {
        return this.message;
    }

    public getCopyValue(): string | undefined {
        return undefined;
    }

    public async performUpdate(): Promise<boolean> {
        return false;
    }

    public async updateData(): Promise<boolean> {
        return false;
    }

    public getPeripheral(): PeripheralBaseNode | undefined {
        return undefined;
    }

    public collectRanges(_ary: AddrRange[]): void {
        // Do nothing
    }

    public saveState(_path?: string): NodeSetting[] {
        return [];
    }

    public findByPath(_path: string[]): PeripheralBaseNode | undefined {
        return undefined;
    }
}
