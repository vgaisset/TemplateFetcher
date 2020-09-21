export function Ensures<T>(constraintName: string, checkFunction: (value: T) => boolean) {
    return (target: any, propertyKey: string) => {
        const privatePropertyKey = '_' + propertyKey

        target[privatePropertyKey] = target[propertyKey]
        function getter(this: any) {
            return this[privatePropertyKey]
        }
        function setter(this: any, newValue: T) {
            if(checkFunction(newValue)) {
                this[privatePropertyKey] = newValue
            } else {
                throw new Error(`Property '${propertyKey}' does not satisfy constraint '${constraintName}'`)
            }
        } 
        Object.defineProperty(target, propertyKey, {
            get: getter,
            set: setter
        })
    }
}

export function NotNull() {
    return Ensures<any>('Can not be undefined', value => value !== undefined)
}

export function NotEmpty(map = (value: string) => value) {
    return Ensures<string>('Can not be empty', value => map(value).length > 0)
}

export function NotNegative() {
    return Ensures<number>('Can not be negative', value => value >= 0)
}

export function MatchRegex(regex: RegExp, errorMessage = `The regex '${regex.source}' is not satisfied`) {
    return Ensures<string>(errorMessage, value => regex.test(value))
}