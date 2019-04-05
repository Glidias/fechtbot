const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const CharacterSchema = new Schema(
    {
        server_id: {
            type: Number,
            required: true
        },
        user_id: {
            type: Number,
            required: true
        },
        handle: {
            type: String,
            default: ""
        },
        data: {
            type: String,
            default: ""
        },
        dead: {
            type: Number,
            default: 0
        }
    }
);

const Character = mongoose.model('Character', CharacterSchema);

module.exports = { Character };
