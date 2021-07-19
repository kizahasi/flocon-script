// prototype汚染を防ぐため、オブジェクトをラップしたclass（SBoolean, SNumberなど）を定義している

import { mapToRecord } from '@kizahasi/util';
import { Option } from '@kizahasi/option';
import { ScriptError } from './ScriptError';
import { Range } from './range';

export type AstInfo = {
    range?: Range;
};

export type GetParams = {
    property: FValue;
    astInfo?: AstInfo;
};

export type SetParams = {
    property: FValue;
    newValue: FValue;
    astInfo?: AstInfo;
};

export type OnGettingParams = {
    key: string | number;
    astInfo?: AstInfo;
};

export type OnSettingParams = {
    key: string | number;
    newValue: FValue;
    astInfo?: AstInfo;
};

type FObjectBase = {
    get(params: GetParams): FValue;
    set(params: SetParams): void;
    toPrimitiveAsNumber(): number;
    toPrimitiveAsString(): string;
    toPrimitiveAsDefault?(): number | string;
};

export namespace FType {
    export const Boolean = 'Boolean';
    export const Number = 'Number';
    export const String = 'String';
    export const Array = 'Array';
    export const Record = 'Record';
    export const Function = 'Function';
}

const tryToPropertyName = (value: FValue): string | undefined => {
    switch (value?.type) {
        case FType.Number:
        case FType.String:
            return value.raw.toString();
        default:
            return undefined;
    }
};

export const toTypeName = (value: FValue) => {
    if (value === null) {
        return 'null';
    }
    if (value === undefined) {
        return 'undefined';
    }
    return value.type;
};

type TypesOption = {
    array?: boolean;
    boolean?: boolean;
    function?: boolean;
    null?: boolean;
    number?: boolean;
    object?: boolean;
    string?: boolean;
    undefined?: boolean;
};

const typesOptionToString = (source: TypesOption) => {
    const base = [
        source.array == null ? 'array' : null,
        source.boolean == null ? 'boolean' : null,
        source.function == null ? 'function' : null,
        source.null == null ? 'null' : null,
        source.number == null ? 'number' : null,
        source.object == null ? 'object' : null,
        source.string == null ? 'string' : null,
        source.undefined == null ? 'undefined' : null,
    ].reduce((seed, elem) => {
        if (seed === '') {
            return elem;
        }
        return `${seed}, ${elem}`;
    }, '');
    return `[${base}]`;
};

class JObjectCaster<T = never> {
    private constructor(
        private readonly source: FValue,
        private readonly addedTypes: TypesOption,
        private readonly successfullyCastedValue: Option<T>
    ) {}

    public static begin(source: FValue) {
        return new JObjectCaster<never>(source, {}, Option.none());
    }

    public cast(errorRange?: Range): T {
        if (this.successfullyCastedValue.isNone) {
            throw new ScriptError(
                `Expected type: ${typesOptionToString(this.addedTypes)}, Actual type: ${toTypeName(
                    this.source
                )}`,
                errorRange
            );
        }
        return this.successfullyCastedValue.value;
    }

    public addArray(): JObjectCaster<T | FValue[]> {
        if (this.source instanceof FArray) {
            return new JObjectCaster<T | FValue[]>(
                this.source,
                { ...this.addedTypes, array: true },
                Option.some(this.source.raw)
            );
        }
        return this;
    }

    public addBoolean(): JObjectCaster<T | boolean> {
        if (this.source instanceof FBoolean) {
            return new JObjectCaster<T | boolean>(
                this.source,
                { ...this.addedTypes, boolean: true },
                Option.some(this.source.raw)
            );
        }
        return this;
    }

    public addFunction(): JObjectCaster<T | ((isNew: boolean) => (args: FValue[]) => FValue)> {
        if (this.source instanceof FFunction) {
            const source = this.source;
            return new JObjectCaster<T | ((isNew: boolean) => (args: FValue[]) => FValue)>(
                source,
                { ...this.addedTypes, function: true },
                Option.some((isNew: boolean) => (args: FValue[]) => source.exec({ args, isNew }))
            );
        }
        return this;
    }

    public addNull(): JObjectCaster<T | null> {
        if (this.source === null) {
            const source = this.source;
            return new JObjectCaster<T | null>(
                source,
                { ...this.addedTypes, null: true },
                Option.some(null)
            );
        }
        return this;
    }

    public addNumber(): JObjectCaster<T | number> {
        if (this.source instanceof FNumber) {
            return new JObjectCaster<T | number>(
                this.source,
                { ...this.addedTypes, number: true },
                Option.some(this.source.raw)
            );
        }
        return this;
    }

    public addObject(): JObjectCaster<T | FObject> {
        if (this.source instanceof FObject) {
            return new JObjectCaster<T | FObject>(
                this.source,
                { ...this.addedTypes, object: true },
                Option.some(this.source)
            );
        }
        return this;
    }

    public addString(): JObjectCaster<T | string> {
        if (this.source instanceof FString) {
            return new JObjectCaster<T | string>(
                this.source,
                { ...this.addedTypes, string: true },
                Option.some(this.source.raw)
            );
        }
        return this;
    }

    public addUndefined(): JObjectCaster<T | undefined> {
        if (this.source === undefined) {
            const source = this.source;
            return new JObjectCaster<T | undefined>(
                source,
                { ...this.addedTypes, undefined: true },
                Option.some(undefined)
            );
        }
        return this;
    }
}

export const beginCast = (source: FValue) => {
    return JObjectCaster.begin(source);
};

export class FBoolean implements FObjectBase {
    public constructor(public readonly raw: boolean) {}

    private static prepareInstanceMethod(
        $this: FValue,
        isNew: boolean,
        astInfo: AstInfo | undefined
    ): FBoolean {
        if (isNew) {
            throw ScriptError.notConstructorError(astInfo?.range);
        }
        if ($this?.type !== FType.Boolean) {
            throw new ScriptError(
                `Expected 'this' to be an Boolean, but actully ${toTypeName($this)}`,
                astInfo?.range
            );
        }
        return $this;
    }

    public get type(): typeof FType.Boolean {
        return FType.Boolean;
    }

    public get({ property, astInfo }: GetParams): FValue {
        const propertyName = tryToPropertyName(property);
        switch (propertyName) {
            case 'toString':
                return new FFunction(
                    ({ $this, isNew }) => {
                        const $$this = FBoolean.prepareInstanceMethod($this, isNew, astInfo);
                        return new FString($$this.raw.toString());
                    },
                    this,
                    false
                );
            default:
                return undefined;
        }
    }

    public set({ astInfo }: SetParams): void {
        throw new ScriptError('You cannot set any value to Boolean', astInfo?.range);
    }

    public toPrimitiveAsString() {
        return this.raw.toString();
    }

    public toPrimitiveAsNumber() {
        return +this.raw;
    }

    public toJObject(): boolean {
        return this.raw;
    }
}

export class FNumber implements FObjectBase {
    public constructor(public readonly raw: number) {}

    private static prepareInstanceMethod(
        $this: FValue,
        isNew: boolean,
        astInfo: AstInfo | undefined
    ): FNumber {
        if (isNew) {
            throw ScriptError.notConstructorError(astInfo?.range);
        }
        if ($this?.type !== FType.Number) {
            throw new ScriptError(
                `Expected 'this' to be an Number, but actully ${toTypeName($this)}`,
                astInfo?.range
            );
        }
        return $this;
    }

    public get type(): typeof FType.Number {
        return FType.Number;
    }

    public get({ property, astInfo }: GetParams): FValue {
        const propertyName = tryToPropertyName(property);
        switch (propertyName) {
            // TODO: もっと実装する
            case 'toString':
                return new FFunction(
                    ({ args, $this, isNew }) => {
                        const $$this = FNumber.prepareInstanceMethod($this, isNew, astInfo);
                        const radix = args[0];
                        return new FString(
                            $$this.raw.toString(
                                beginCast(radix).addNumber().addUndefined().cast(astInfo?.range)
                            )
                        );
                    },
                    this,
                    false
                );
            default:
                return undefined;
        }
    }

    public set({ astInfo }: SetParams): void {
        throw new ScriptError('You cannot set any value to Number', astInfo?.range);
    }

    public toPrimitiveAsString() {
        return this.raw.toString();
    }

    public toPrimitiveAsNumber() {
        return +this.raw;
    }

    public toJObject(): number {
        return this.raw;
    }
}

export class FString implements FObjectBase {
    public constructor(public readonly raw: string) {}

    private static prepareInstanceMethod(
        $this: FValue,
        isNew: boolean,
        astInfo: AstInfo | undefined
    ): FString {
        if (isNew) {
            throw ScriptError.notConstructorError(astInfo?.range);
        }
        if ($this?.type !== FType.String) {
            throw new ScriptError(
                `Expected 'this' to be an String, but actully ${toTypeName($this)}`,
                astInfo?.range
            );
        }
        return $this;
    }

    public get type(): typeof FType.String {
        return FType.String;
    }

    public get({ property, astInfo }: GetParams): FValue {
        const propertyName = tryToPropertyName(property);
        switch (propertyName) {
            // TODO: もっと実装する
            case 'toString':
                return new FFunction(
                    ({ $this, isNew }) => {
                        const $$this = FString.prepareInstanceMethod($this, isNew, astInfo);
                        return $$this;
                    },
                    this,
                    false
                );
            default:
                return undefined;
        }
    }

    public set({ astInfo }: SetParams): void {
        throw new ScriptError('You cannot set any value to String', astInfo?.range);
    }

    public toPrimitiveAsString() {
        return this.raw.toString();
    }

    public toPrimitiveAsNumber() {
        return +this.raw;
    }

    public toJObject(): string {
        return this.raw;
    }
}

export class FArray implements FObjectBase {
    public constructor(public readonly raw: FValue[]) {}

    private static prepareInstanceMethod(
        $this: FValue,
        isNew: boolean,
        astInfo: AstInfo | undefined
    ): FArray {
        if (isNew) {
            throw ScriptError.notConstructorError(astInfo?.range);
        }
        if ($this?.type !== FType.Array) {
            throw new ScriptError(
                `Expected 'this' to be an Array, but actully ${toTypeName($this)}`,
                astInfo?.range
            );
        }
        return $this;
    }

    public get type(): typeof FType.Array {
        return FType.Array;
    }

    private static isValidIndex(index: string): boolean {
        return index === '0' || /^[1-9][0-9]*$/.test(index);
    }

    public get({ property, astInfo }: GetParams): FValue {
        const index = beginCast(property).addString().addNumber().cast(astInfo?.range).toString();
        if (FArray.isValidIndex(index)) {
            return this.raw[index as unknown as number];
        }
        const propertyName = index;
        switch (propertyName) {
            case 'filter':
                return new FFunction(
                    ({ args, $this, isNew }) => {
                        const $$this = FArray.prepareInstanceMethod($this, isNew, astInfo);
                        const predicate = beginCast(args[0]).addFunction().cast(astInfo?.range)(
                            false
                        );
                        const raw = $$this.raw.filter((value, index, array) =>
                            predicate([value, new FNumber(index), new FArray(array)])?.toJObject()
                        );
                        return new FArray(raw);
                    },
                    this,
                    false
                );
        }
        throw new ScriptError(`"${index}" is an invalid index`, astInfo?.range);
    }

    public set({ property, newValue, astInfo }: SetParams): void {
        const index = beginCast(property).addNumber().addString().toString();
        if (FArray.isValidIndex(index)) {
            this.raw[index as unknown as number] = newValue;
            return;
        }
        throw new ScriptError(`"${index}" is an invalid index`, astInfo?.range);
    }

    public toPrimitiveAsString(): string {
        return this.raw.map(x => x?.toPrimitiveAsString()).toString();
    }

    public toPrimitiveAsNumber(): number {
        return +this.raw.map(x => x?.toPrimitiveAsNumber());
    }

    // 正確な型が表現できないのでunknown[]としている
    public toJObject(): unknown[] {
        return this.raw.map(x => (x == null ? x : x.toJObject()));
    }
}

// Mapに変換することで、外界から受け取ったオブジェクトに対する破壊的な操作を起こせないようにしている。
export class FObject implements FObjectBase {
    private readonly raw: Map<string, FValue>;

    public constructor(base?: FObject) {
        if (base != null) {
            this.raw = new Map(base.raw);
        } else {
            this.raw = new Map();
        }
    }

    public get type(): typeof FType.Record {
        return FType.Record;
    }

    protected onGetting(params: OnGettingParams): Option<FValue> {
        return Option.none();
    }

    public get({ property, astInfo }: GetParams): FValue {
        const key = beginCast(property).addString().addNumber().cast(astInfo?.range);
        const onGettingResult = this.onGetting({ key, astInfo });
        if (!onGettingResult.isNone) {
            return onGettingResult.value;
        }
        return this.raw.get(key.toString());
    }

    // setを拒否したい場合は何かをthrowする。
    protected onSetting(params: OnSettingParams): void {
        return;
    }

    public set({ property, newValue, astInfo }: SetParams): void {
        const key = beginCast(property).addNumber().addString().cast(astInfo?.range);
        this.onSetting({ key, newValue, astInfo });
        this.raw.set(key.toString(), newValue);
    }

    public toPrimitiveAsString() {
        return {}.toString();
    }

    public toPrimitiveAsNumber() {
        return +{};
    }

    // 継承されるケースを考えて、Record<string, unknown>ではなくunknownを返すようにしている
    public toJObject(): unknown {
        const result = new Map<string, unknown>();
        this.raw.forEach((value, key) => {
            result.set(key, value?.toJObject());
        });
        return mapToRecord(result);
    }
}

type FFunctionParams = {
    args: FValue[];
    isNew: boolean;
};

export class FFunction implements FObjectBase {
    public constructor(
        private readonly func: (params: FFunctionParams & { $this: FValue }) => FValue,

        // Function内のthisを表す値。
        // isArrowFunction === false のとき、fを作成するとして、例えばx.fの場合はxを渡し、単にfの場合はundefinedを渡す。
        // isArrowFunction === true のときはそこに位置するthisを渡す。
        private readonly $this: FValue,

        private readonly isArrowFunction: boolean
    ) {}

    public bind($this: FValue): FFunction {
        return new FFunction(this.func, $this, this.isArrowFunction);
    }

    public get type(): typeof FType.Function {
        return FType.Function;
    }

    public exec(params: FFunctionParams): FValue {
        return this.func({ ...params, $this: this.$this });
    }

    protected onGetting(params: OnGettingParams): Option<FValue> {
        return Option.none();
    }

    public get({ property, astInfo }: GetParams): FValue {
        const key = beginCast(property).addNumber().addString().cast(astInfo?.range);
        const onGettingResult = this.onGetting({ key, astInfo });
        if (!onGettingResult.isNone) {
            return onGettingResult.value;
        }
        // TODO: 実装する。ただし、実装するものは注意して選んだほうがいい（結果としてどれも実装しないことになるかも）。
        return undefined;
    }

    public set({ astInfo }: SetParams): void {
        throw new ScriptError('You cannot set any value to Function', astInfo?.range);
    }

    public toPrimitiveAsString() {
        return (() => {
            return;
        }).toString();
    }

    public toPrimitiveAsNumber() {
        return +(() => {
            return;
        });
    }

    // eslint-disable-next-line @typescript-eslint/ban-types
    public toJObject(): Function {
        return () => {
            throw new Error('Not supported');
        };
    }
}

export type FValue = null | undefined | FBoolean | FNumber | FString | FArray | FObject | FFunction;

const self = 'self';
const globalThis = 'globalThis';

// keyが'self'か'globalThis'のときは自分自身を返すSRecord
// baseでkeyが'self'か'globalThis'である要素は全て無視される
export class FGlobalRecord extends FObject {
    public constructor(base?: FObject) {
        super(base);
    }

    protected override onGetting({ key }: OnGettingParams) {
        const keyAsString = key.toString();
        if (keyAsString === self || keyAsString === globalThis) {
            return Option.some(this);
        }
        return Option.none();
    }

    protected override onSetting({ key, astInfo }: OnSettingParams) {
        const keyAsString = key.toString();
        if (keyAsString === self || keyAsString === globalThis) {
            throw new ScriptError(
                `Assignment to '${keyAsString}' is not supported`,
                astInfo?.range
            );
        }
    }
}

export function createFValue(source: unknown): FValue {
    if (source === null) {
        return null;
    }
    if (source === undefined) {
        return undefined;
    }
    switch (typeof source) {
        case 'boolean':
            return new FBoolean(source);
        case 'number':
            return new FNumber(source);
        case 'string':
            return new FString(source);
        case 'function':
            throw new Error('Function is not supported. Use FFunction instead.');
        default:
            break;
    }
    if (
        source instanceof FArray ||
        source instanceof FBoolean ||
        source instanceof FFunction ||
        source instanceof FNumber ||
        source instanceof FObject ||
        source instanceof FString
    ) {
        return source;
    }
    if (Array.isArray(source)) {
        return new FArray(source.map(x => createFValue(x)));
    }
    return createFObject(source as Record<string, unknown>);
}

// __proto__ のチェックなどは行われない
function createFObject(source: Record<string, unknown>): FObject {
    const result = new FObject();
    for (const key in source) {
        result.set({
            property: new FString(key),
            newValue: createFValue(source[key]),
            astInfo: undefined,
        });
    }
    return result;
}

// keyが'self'か'globalThis'である要素は無視されることに注意
export function createFGlobalRecord(source: Record<string, unknown>): FGlobalRecord {
    return new FGlobalRecord(createFObject(source));
}

// https://ja.javascript.info/object-toprimitive
const toPrimitive = (value: FValue, hint: 'default' | 'string' | 'number') => {
    if (value == null) {
        return value;
    }

    if (hint === 'string') {
        return value.toPrimitiveAsString();
    }

    if (hint === 'number') {
        return value.toPrimitiveAsNumber();
    }

    const obj: FObjectBase = value;
    if (obj.toPrimitiveAsDefault == null) {
        return obj.toPrimitiveAsNumber();
    }

    return obj.toPrimitiveAsDefault();
};

export const eqeqeq = (x: FValue, y: FValue): boolean => {
    if (x === null) {
        return y === null;
    }
    if (x === undefined) {
        return y === undefined;
    }
    switch (x.type) {
        case FType.Boolean:
        case FType.Number:
        case FType.String:
            if (y?.type !== x.type) {
                return false;
            }
            return x.raw === y.raw;
        default:
            return x === y;
    }
};

// 例えばxとyがObjectのときは x === y で比較されるため、「toPrimitiveで変換してから==で比較」という作戦は使えない。そのため、ここで専用の関数を定義している。
// https://developer.mozilla.org/ja/docs/Web/JavaScript/Equality_comparisons_and_sameness
export const eqeq = (x: FValue, y: FValue): boolean => {
    if (x == null) {
        return y == null;
    }
    if (y == null) {
        return false;
    }

    switch (x.type) {
        case FType.Boolean:
        case FType.Number:
        case FType.String:
            switch (y.type) {
                case FType.Boolean:
                case FType.Number:
                case FType.String:
                    // eslint-disable-next-line eqeqeq
                    return x.raw == y.raw;
                default:
                    // eslint-disable-next-line eqeqeq
                    return x.raw == toPrimitive(y, 'default');
            }
        default:
            switch (y.type) {
                case FType.Boolean:
                case FType.Number:
                case FType.String:
                    // eslint-disable-next-line eqeqeq
                    return toPrimitive(x, 'default') == y.raw;
                default:
                    return x === y;
            }
    }
};

const compare = <T>(
    left: FValue,
    right: FValue,
    hint: 'default' | 'string' | 'number',
    comparer: (left: unknown, right: unknown) => T
): T => {
    return comparer(toPrimitive(left, hint), toPrimitive(right, hint));
};

export const compareToNumber = (
    left: FValue,
    right: FValue,
    hint: 'default' | 'string' | 'number',
    comparer: (left: any, right: any) => number
) => {
    return new FNumber(compare(left, right, hint, comparer));
};

export const compareToBoolean = (
    left: FValue,
    right: FValue,
    hint: 'default' | 'string' | 'number',
    comparer: (left: any, right: any) => boolean
) => {
    return new FBoolean(compare(left, right, hint, comparer));
};

export const compareToNumberOrString = (
    left: FValue,
    right: FValue,
    hint: 'default',
    comparer: (left: any, right: any) => number | string
) => {
    const r = compare(left, right, hint, comparer);
    if (typeof r === 'number') {
        return new FNumber(r);
    }
    return new FString(r);
};

// https://developer.mozilla.org/ja/docs/Glossary/Falsy
export const isTruthy = (value: FValue): boolean => {
    if (value == null) {
        return false;
    }
    switch (value.type) {
        case FType.Boolean:
        case FType.Number:
        case FType.String:
            if (value.raw) {
                return true;
            } else {
                return false;
            }
        default:
            return true;
    }
};
