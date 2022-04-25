export class UserExistsException extends Error {
    constructor(m: string) {
        super(m);

        // Set the prototype explicitly.
        Object.setPrototypeOf(this, UserExistsException.prototype);
    }
}
