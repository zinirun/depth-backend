import mongoose, { CallbackError } from 'mongoose';

export const deepNestedPlugin = (schema: mongoose.Schema, populateOptions: any[]) => {
    // @ts-ignore
    schema.pre('find', async function (this, next: (err?: CallbackError) => void) {
        populateOptions.forEach((option) => this.populate(option));
        next();
    });

    // @ts-ignore
    schema.pre('findOne', async function (this, next: (err?: CallbackError) => void) {
        populateOptions.forEach((option) => this.populate(option));
        next();
    });

    // @ts-ignore
    schema.pre('findById', async function (this, next: (err?: CallbackError) => void) {
        populateOptions.forEach((option) => this.populate(option));
        next();
    });
};
