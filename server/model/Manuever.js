const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const ManueverSchema = new Schema(
    {
        channel_id: {
            type: String,
            required: true
        },
        mention: {
            type: String,
            required: true
        },
        slot: {
            type: Number,
            required: true,
            default: 0
        },
        label: {
            type: String,
            trim: true,
            required: true,
            default: "~"
        },
        roll: {
            type: String,
            trim: true,
            default: ""
        },
        comment: {
            type: String,
            trim: true,
            default: ""
        },
        replyTo: {
            type: Number,
            default: 0
        },
        characterState: {
            type: Schema.Types.ObjectId,
            ref: 'CharacterState'
        },
        react: {
            type: Boolean,
            default: false
        }
    }
);

const Manuever = mongoose.model('Manuever', ManueverSchema);

module.exports = { Manuever };
