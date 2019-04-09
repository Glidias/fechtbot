const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const UserSchema = new Schema(
    {
       user_id: {
           type: String,
           required: true
       },
        channel_id: {
            type: String,
            required: true
        }
        /*
        fecht: {
            type: Schema.Types.ObjectId,
            ref: 'Fecht'
        },
        */
    }
);

const User = mongoose.model('User', UserSchema);

module.exports = { User };
