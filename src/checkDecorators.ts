type CheckFunction<T> = (value: T, oldValue: T | undefined) => boolean
type ConstraintChecker<T> = { name: string, checker: CheckFunction<T> }

/**
 * Applies a constraint to a property.
 * This constraint will be checked every time the property is set.
 * 
 * *Note: Numerous constraints can be attached to a same property.*
 * @param constraintName This name will be used in error message if the constraint is not fullfilled.
 * @param checkFunction The function making sure the constraint is fullfilled. If it returns true,
 * then the constraint is respected, otherwise, it is not.
 * @throws Error if at least one of the check functions registered for a same property return false.
 */
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

/**
 * Ensures a property is not null.
 */
export function NotNull() {
    return Requires<any>('Can not be undefined', value => value !== undefined)
}

/**
 * Ensures a string property is not empty.
 * @param map A function to apply to the value to test.
 */
export function NotEmpty(map = (value: string) => value) {
    return Requires<string>('Can not be empty', value => map(value).length > 0)
}

/**
 * Ensures a number property value is always positive (>= 0).
 * @param regex 
 * @param errorMessage 
 */
export function NotNegative() {
    return Requires<number>('Can not be negative', value => value >= 0)
}

/**
 * Ensures a string property always respects the given regex.
 * @param regex 
 * @param errorMessage 
 */
export function MatchRegex(regex: RegExp, errorMessage = `The regex '${regex.source}' is not satisfied`) {
    return Requires<string | undefined>(errorMessage, value => !value || regex.test(value))
}
