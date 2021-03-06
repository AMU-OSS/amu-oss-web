const functions = require('firebase-functions');
const admin = require('firebase-admin');
const moment = require('moment');

admin.initializeApp();

function setIfExists(source, destrination, property, validator) {
  if (!source[property])
    return;
  if (validator && (typeof source[property] !== validator))
    return;
  destrination[property] = source[property];
}

function createNotification(payload) {
  const datum = {};
  datum.notification = {};
  const notification = datum.notification;
  if (!payload.body)
    return null;

  const properties = ['title', 'body', 'icon', 'color'];
  for (const property of properties)
    setIfExists(payload, notification, property, 'string');

  setIfExists(payload, datum, 'data', 'object');

  return datum;
}

exports.sendNotification = functions.database.ref('/notifications/{pushId}')
.onWrite((data, context) => {
  // Only edit data when it is first created.
  if (data.before.val()) {
    return null;
  }

  // Grab the current value of what was written to the Realtime Database.
  const original = data.after.val();

  // Exit when the data is deleted.
  if (!original) {
    return null;
  }

  if (original.sent === true) {
    console.log('Notification already sent. Skipping...', original);
    return null;
  }

  original.timestamp = moment().toISOString()

  if (original.skip === true) {
    console.log('Notification set to skip. Skipping...', original);
  } else {
    const notification = createNotification(original);

    if (notification) {
      const topic = original.topic || 'all';

      console.log('Sending notification to topic', topic, notification);

      return admin.messaging().sendToTopic(topic, notification)
        .then(function (response) {
            original.sent = true;
            console.log('Notification Sent', response);
            return data.after.ref.set(original);
        }).catch(function (error) {
            original.failed = true;
            original.failureCause = error;
            console.log('Sending Notification Failed', error);
            return data.after.ref.set(original);
        });
    } else {
        console.log('Minimum requirements for notification not met. Skipping...');
    }
  }

  return data.after.ref.set(original);
});