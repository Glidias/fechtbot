const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const CharacterSchema = new Schema(
    {
        server_id: {
            type: String,
            required: true
        },
        user_id: {
            type: String,
            required: true
        },
        handle: {
            type: String,
            default: ""
        },
        data: {
            type: String,
            default: ""
        }
    }
);

const Character = mongoose.model('Character', CharacterSchema);

module.exports = { Character };
