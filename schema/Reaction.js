"use strict";

const {GraphQLInputObjectType, GraphQLObjectType, GraphQLNonNull, GraphQLString, GraphQLList, GraphQLInt} = require("graphql");

const type = new GraphQLObjectType({
  name: "Reaction",
  fields: {
    userName: { type: new GraphQLNonNull(GraphQLString) },
    emoji: { type: new GraphQLNonNull(GraphQLString) }
  }
});

const inputType = new GraphQLInputObjectType({
  name: "ReactionInput",
  fields: {
    userName: { type: new GraphQLNonNull(GraphQLString) },
    emoji: { type: new GraphQLNonNull(GraphQLString) }
  }
});

module.exports.NotificationToReactions = {
  type: new GraphQLNonNull(GraphQLList(new GraphQLNonNull(type))),
  resolve: function(notification) { return notification.reactions || []; }
};

module.exports.build = function({mutation}) {
  mutation.createReaction = {
    type: new GraphQLNonNull(type),
    args: {
      eventCode: { type: new GraphQLNonNull(GraphQLString) },
      notificationIndex: { type: new GraphQLNonNull(GraphQLInt) },
      reaction: { type: new GraphQLNonNull(inputType) }
    },
    resolve: function(_, {eventCode, notificationIndex, reaction}, {db, Events}) {
      return new Promise(function(resolve, reject) {
        db.get({
          TableName: Events,
          Key: {id: eventCode}
        }, function (err, data) {
          if (err) return reject(err.message);
          if (!data.Item) return reject("eventCode " + eventCode + " doesn't exist on DB");
          const notifications = data.Item.notifications;
          if (!notifications || notificationIndex < 0 || notificationIndex >= notifications.length) 
            return reject("notification[" + notificationIndex + "] doesn't exist on DB " + 
              "(notifications.length: " + ((notifications)? notifications.length : "null") + " )");
          const targetNotification = notifications[notificationIndex];
          const reactions = targetNotification.reactions || [];
          const reactionIndex = reactions.findIndex(function(elm) {
            return (elm.userName == reaction.userName && elm.emoji == reaction.emoji);
          });
          if (reactionIndex >= 0) return resolve(reaction);
          db.update({
            TableName: Events,
            Key: { id: eventCode },
            UpdateExpression: "SET notifications[" + notificationIndex + "].reactions = list_append(if_not_exists(notifications[" + notificationIndex + "].reactions, :empty_list), :x)",
            ExpressionAttributeValues: { 
              ":x": [reaction],
              ":empty_list": [],
              ":notification_index": notificationIndex
            },
            ConditionExpression: [
              "attribute_exists(id)",
              "attribute_exists(notifications)",
              "size(notifications) > :notification_index"
            ].join(" AND ")
          }, function(err, data) {
            if (err) return reject(err.message);
            return resolve(reaction);
          });
        });
      });
    }
  };

  mutation.deleteReaction = {
    type: new GraphQLNonNull(type),
    args: {
      eventCode: { type: new GraphQLNonNull(GraphQLString) },
      notificationIndex: { type: new GraphQLNonNull(GraphQLInt) },
      reaction: { type: new GraphQLNonNull(inputType) }
    },
    resolve: function(_, {eventCode, notificationIndex, reaction}, {db, Events}) {
      return new Promise(function(resolve, reject) {
        db.get({
          TableName: Events,
          Key: { id: eventCode }
        }, function (err, data) {
          if (err) return reject(err.message);
          if (!data.Item) return reject("eventCode " + eventCode + " doesn't exist on DB");
          const notifications = data.Item.notifications;
          if (!notifications || notificationIndex < 0 || notificationIndex >= notifications.length) 
            return reject("notification[" + notificationIndex + "] doesn't exist on DB" + 
              "(notifications.length: " + ((notifications) ? notifications.length : "null")+ " )");
          const targetNotification = notifications[notificationIndex];
          const reactions = targetNotification.reactions || [];
          const reactionIndex = reactions.findIndex(function(elm) {
            return (elm.userName == reaction.userName && elm.emoji == reaction.emoji);
          });
          if (reactionIndex < 0) return resolve(reaction);
          console.log(data.Item);
          console.log(data.Item.notifications);
          console.log(data.Item.notifications[0].reactions);
          db.update({
            TableName: Events,
            Key: { id: eventCode },
            UpdateExpression: "REMOVE notifications[" + notificationIndex + "].reactions[" + reactionIndex + "]",
            ExpressionAttributeValues: { 
              ":userName": reaction.userName,
              ":emoji": reaction.emoji,
              ":notification_index": notificationIndex,
              ":reaction_index": reactionIndex
            },
            ConditionExpression: [
              "attribute_exists(id)",
              "attribute_exists(notifications)",
              "size(notifications) > :notification_index",
              "attribute_exists(notifications[" + notificationIndex + "].reactions)",
              "size(notifications[" + notificationIndex + "].reactions) > :reaction_index",
              "notifications[" + notificationIndex + "].reactions[" + reactionIndex + "].userName = :userName",
              "notifications[" + notificationIndex + "].reactions[" + reactionIndex + "].emoji = :emoji"
            ].join(" AND ")
          }, function(err, data) {
            if (err) return reject(err.message);
            return resolve(reaction);
          });
        });
      });
    }
  };
}
