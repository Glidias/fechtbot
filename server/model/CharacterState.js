const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const CharacterStateSchema = new Schema(
    {
        mention: {
            type: String,
            required: true	
        },
        fecht: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: 'Fecht'
        },
        channel_id: {
            type: String,
            required: true
        },
        dead: {
            type: Number,
            default: 0
        },
        side: {
            type: String,
            default: ""
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
            required: false,    // temporary for now
            ref: 'Character'
        }
    }
);

const CharacterState = mongoose.model('CharacterState', CharacterStateSchema);

module.exports = { CharacterState };
