const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const UserSchema = new Schema(
    {
	   user_id: {
		   type: Number,
		   required: true
	   },
	   fecht: {
			type: Schema.Types.ObjectId,
			ref: 'Fecht'
		}
    }
);

const User = mongoose.model('User', UserSchema);

module.exports = { User };
