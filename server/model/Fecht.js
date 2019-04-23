const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const FechtSchema = new Schema(
    {
        channel_id: {
            type: String,
            required: true
        },
        pin_header_id: {
            type: String,
            required: true,
            //default: 0
        },
        latest_footer_id: {
            type: String,
            required: true,
            //default: 0
        },
        latest_body_id: {
            type: String,
            required: true,
            //default: 0
        },
        phaseCount: {
            type: Number,
            default: 0
        },
        roundCount: {
            type: Number,
            default: 0
        },
        gamemaster_id: {
            type: String,
            default: ""
        },
        initStep: {
            type: Number,
            get: v => Math.round(v),
            set: v => Math.round(v),
            alias: 'i',
            default: 0
        },
        initArray: [{
            type: Schema.Types.ObjectId,
            ref: 'CharacterState'
        }],
        initI: {
            type: Number,
            default:0
        },
        miscTurnCount: {
            type: Number,
            default: 0
        },
        backtrackCount: {
            type: Number,
            default:0
        },
        sides: [{
            type: String,
            required: true,
            trim: true
        }],
        phases: [{
            _id: false,
            name: {
                type: String,
                trim: true,
                default: ""
            },
            reactOnly: {
                type: Number
            },
            reacts: [{
                type: String,
                trim: true,
                default: ""
            }],
            initVal: {
                type: Number,
                default: 1
            },
            initSingle: {
                type: Boolean,
                default: false
            },
            dmReacts: [{
                type: String,
                trim: true,
                default: ""
            }],
            reactsM: [{
                type: String,
                trim: true,
                default: ""
            }],
            dmReactsM: [{
                type: String,
                trim: true,
                default: ""
            }],
            reactsD: [{
                type: String,
                trim: true,
                default: ""
            }],
            dmReactsD: [{
                type: String,
                trim: true,
                default: ""
            }],
            floatUseCharInitInt: {
                type: Boolean,
                default: false
            },
            initReact: {
                type: Number,
                default: 0
            },
            initIncludeZero: {
                type: Boolean,
                default: false
            },
            initSort: {
                type: Number,
                default: 0
            },
            resolveSort: {
                type: Number,
                default: 0
            }
        }]
    },
    {
        timestamps: {
            createdAt: 'created_at'
        }
    }
);


const Fecht = mongoose.model('Fecht', FechtSchema);

module.exports = { Fecht };
