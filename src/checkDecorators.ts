type CheckFunction<T> = (value: T, oldValue: T | undefined) => boolean
type ConstraintChecker<T> = { name: string, checker: CheckFunction<T> }

export function Requires<T>(constraintName: string, checkFunction: CheckFunction<T>) {
    return (target: any, propertyKey: string) => {
        const privatePropertyKey = '_' + propertyKey
        const propertyCheckFunctions = privatePropertyKey + '_checkFunctions'

        target[privatePropertyKey] = target[propertyKey]

        if(!target.hasOwnProperty(propertyCheckFunctions)) {
            Object.defineProperty(target, propertyCheckFunctions, {
                value: new Array<ConstraintChecker<T>>()
            })
        }
        (target[propertyCheckFunctions] as Array<ConstraintChecker<T>>).push({name: constraintName, checker: checkFunction})

        function getter(this: any) {
            return this[privatePropertyKey]
        }
        function setter(this: any, newValue: T) {
            const constraints = target[propertyCheckFunctions] as Array<ConstraintChecker<T>>
            const oldValue: T | undefined = this.hasOwnProperty(privatePropertyKey) ? this[privatePropertyKey] : undefined

            constraints.forEach(constraint => {
                if(constraint.checker(newValue, oldValue)) {
                    this[privatePropertyKey] = newValue
                } else {
                    throw new Error(`Property '${propertyKey}' does not satisfy constraint '${constraint.name}'`)
                }
            })

        } 

        Object.defineProperty(target, propertyKey, {
            get: getter,
            set: setter,
            configurable: true,
        })
    }
}

export function NotNull() {
    return Requires<any>('Can not be undefined', value => value !== undefined)
}

export function NotEmpty(map = (value: string) => value) {
    return Requires<string>('Can not be empty', value => map(value).length > 0)
}

export function NotNegative() {
    return Requires<number>('Can not be negative', value => value >= 0)
}

export function MatchRegex(regex: RegExp, errorMessage = `The regex '${regex.source}' is not satisfied`) {
    return Requires<string>(errorMessage, value => value === undefined || regex.test(value))
}
