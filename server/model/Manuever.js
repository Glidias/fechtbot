const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const ManueverSchema = new Schema(
    {
        fecht: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: 'Fecht'
        },
        slot: {
            type: Number,
            required: true
        },
        msg: {
            type: String,
            trim: true,
            required: true
        },
        characterState: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: 'CharacterState'
        }
    }
);

const Manuever = mongoose.model('Manuever', ManueverSchema);

module.exports = { Manuever };
