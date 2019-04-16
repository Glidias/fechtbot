const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const CharacterStateSchema = new Schema(
    {
        user_id_handle: {
            type: String,
            required: true	
        },
        fecht: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: 'Fecht'
        },
        dead: {
            type: Number,
            default: 0
        },
        side: {
            type: Number,
            default: 0
        },
        initVal: {
            type: Number,
            default: 0
        },
        initReact: {
            type: Number,
            default: 0
        },
        character: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: 'Character'
        }
    }
);

const CharacterState = mongoose.model('CharacterState', CharacterStateSchema);

module.exports = { CharacterState };
