/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { AddrRange } from '../../../addrranges';
import { AccessType, EnumerationMap, FieldOptions } from '../../../api-types';
import { NodeSetting } from '../../../common';
import { NumberFormat } from '../../../common/format';
import { PeripheralFieldNode } from '../../../common/peripherals';
import { parseInteger } from '../../../utils';
import { PeripheralBaseNodeImpl } from './base-node';
import { PeripheralRegisterNodeImpl } from './peripheral-register-node';



export class PeripheralFieldNodeImpl extends PeripheralBaseNodeImpl {
    public session: vscode.DebugSession | undefined;
    public readonly name: string;
    public readonly description: string;
    public readonly offset: number;
    public readonly width: number;
    public readonly accessType: AccessType;

    private enumeration: EnumerationMap | undefined;
    private enumerationValues: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private enumerationMap: any;
    private previousValue?: number;

    constructor(public parent: PeripheralRegisterNodeImpl, protected options: FieldOptions) {
        super(parent);

        this.name = options.name;
        this.description = options.description;
        this.offset = options.offset;
        this.width = options.width;

        if (!options.accessType) {
            this.accessType = parent.accessType;
        } else {
            if (parent.accessType === AccessType.ReadOnly && options.accessType !== AccessType.ReadOnly) {
                this.accessType = AccessType.ReadOnly;
            } else if (parent.accessType === AccessType.WriteOnly && options.accessType !== AccessType.WriteOnly) {
                this.accessType = AccessType.WriteOnly;
            } else {
                this.accessType = options.accessType;
            }
        }

        if (options.enumeration) {
            this.setEnumeration(options.enumeration);
        }

        this.parent.addChild(this);
    }

    private setEnumeration(enumeration: EnumerationMap) {
        this.enumeration = enumeration;
        this.enumerationMap = {};
        this.enumerationValues = [];

        for (const key in enumeration) {
            const name = enumeration[key].name;

            this.enumerationValues.push(name);
            this.enumerationMap[name] = key;
        }
    }

    private getCurrentValue(): number {
        return this.parent.extractBits(this.offset, this.width);
    }

    private getResetValue(): number {
        return this.parent.extractBitsFromReset(this.offset, this.width);
    }

    public getEnumerationValue(value: number): string | undefined {
        if (!this.enumeration) {
            return undefined;
        }

        if (this.enumeration[value]) {
            return this.enumeration[value].name;
        }
    }

    public getChildren(): PeripheralBaseNodeImpl[] | Promise<PeripheralBaseNodeImpl[]> {
        return [];
    }

    public performUpdate(value?: string): Thenable<boolean> {
        return new Promise((resolve, reject) => {
            if (this.enumeration) {
                const items: vscode.QuickPickItem[] = [];
                for (const eStr of this.enumerationValues) {
                    const numval = this.enumerationMap[eStr];
                    const e = this.enumeration[numval];
                    const item: vscode.QuickPickItem = {
                        label: eStr,
                        detail: e.description
                    };
                    items.push(item);
                }
                vscode.window.showQuickPick(items).then((val) => {
                    if (val === undefined) {
                        return false;
                    }

                    const numval = this.enumerationMap[val.label];
                    this.parent.updateBits(this.offset, this.width, numval).then(resolve, reject);
                });
            } else {
                vscode.window.showInputBox({ prompt: 'Enter new value: (prefix hex with 0x, binary with 0b)', value }).then((val) => {
                    if (typeof val === 'string') {
                        const numval = parseInteger(val);
                        if (numval === undefined) {
                            return false;
                        }
                        this.parent.updateBits(this.offset, this.width, numval).then(resolve, reject);
                    }
                });
            }
        });
    }

    public updateData(): Thenable<boolean> {
        this.previousValue = this.getCurrentValue();
        return Promise.resolve(true);
    }

    public saveState(path: string): NodeSetting[] {
        if (this.format !== NumberFormat.Auto) {
            return [{ node: `${path}.${this.name}`, format: this.format }];
        } else {
            return [];
        }
    }

    public findByPath(path: string[]): PeripheralBaseNodeImpl | undefined {
        if (path.length === 0) {
            return this;
        } else {
            return undefined;
        }
    }

    public getPeripheral(): PeripheralBaseNodeImpl {
        return this.parent.getPeripheral();
    }

    public collectRanges(_a: AddrRange[]): void {
        throw new Error('Method not implemented.');
    }

    public resolveDeferedEnums(enumTypeValuesMap: { [key: string]: EnumerationMap; }) {
        if (this.options.derivedFrom) {
            const map = enumTypeValuesMap[this.options.derivedFrom];
            if (map) {
                this.setEnumeration(map);
                this.options.derivedFrom = undefined;
            } else {
                throw new Error(`Invalid derivedFrom=${this.options.derivedFrom} for enumeratedValues of field ${this.name}`);
            }
        }
    }

    serialize(): PeripheralFieldNode {
        return PeripheralFieldNode.create({
            ...super.serialize(),
            ...this.options,
            parentAddress: this.parent.getAddress(),
            previousValue: this.previousValue,
            currentValue: this.getCurrentValue(),
            resetValue: this.getResetValue(),
        });
    }
}