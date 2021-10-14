import { Option } from '@kizahasi/option';
import { ScriptError } from '../ScriptError';
import { beginCast } from './cast';
import { FType } from './FType';
import { FValue } from './FValue';
import { FObjectBase, GetCoreParams, GetParams, SetParams } from './types';

type FFunctionParams = {
    args: FValue[];
    isNew: boolean;
};

export class FFunction implements FObjectBase {
    public constructor(private readonly func: (params: FFunctionParams) => FValue) {}

    public get type(): typeof FType.Function {
        return FType.Function;
    }

    public exec(params: FFunctionParams): FValue {
        return this.func({ ...params });
    }

    protected onGetting(params: GetCoreParams): Option<FValue> {
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