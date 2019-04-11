const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const DMReactSchema = new Schema(
    {
       user_id: {
           type: String,
           required: true
	   },
	   handle: {
			type: String,
			default:""
		},
        channel_id: {
            type: String,
            required: true
		},
		message_id: {
			type: String,
            required: true
		},
		content: {
			type: String,
			required: true
		},
		result: {
			type: String,
			default: ""
		}
    }
);

const DMReact = mongoose.model('DMReact', DMReactSchema);

module.exports = { DMReact };
