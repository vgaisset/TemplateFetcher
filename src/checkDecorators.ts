type ConstraintChecker<T> = { name: string, checker: (value: T) => boolean }

export function Ensures<T>(constraintName: string, checkFunction: (value: T) => boolean) {
    return (target: any, propertyKey: string) => {
        const privatePropertyKey = '_' + propertyKey
        const propertyCheckFunctions = privatePropertyKey + '_checkFunctions'

        console.log(JSON.stringify(target) + ' with key ' + propertyKey)
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
        function setter(this: any, newValue: T, that?: any) {
            if(this !== undefined) that = this

            const constraints = target[propertyCheckFunctions] as Array<ConstraintChecker<T>>

            constraints.forEach(constraint => {
                if(constraint.checker(newValue)) {
                    this[privatePropertyKey] = newValue
                } else {
                    throw new Error(`Property '${propertyKey}' does not satisfy constraint '${constraint.name}'`)
                }
            })

        } 

        Object.defineProperty(target, propertyKey, {
            get: getter,
            set: setter,
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
    return Ensures<string>(errorMessage, value => value === undefined || regex.test(value))
}