
# Spark SDK

## About

The Spark SDK allows organizations to write plugins for the Vatom Platform. It performs many functions that simplify communication with the Vatom Spark Engine including security. 

## Installation

```bash
yarn add @vatom/spark-sdk
```

Create your plugin starting with a single file (e.g. index.ts) with the following minimum structure:

```js
import Spark from "@vatom/spark-sdk";

const descriptor: any = {
  namespace: "xprize.org", // namepsace of the room events - e.g. io.dgov.room.poll
  plugin_id: "xprize"
  facades: {
     // Register message and model facades
    message: [
        {
            id: "m.room.message",
            actions: ["reply", "react", "flag"],
            name: "Post",
        }
    ],
    modal: [

    ]
  },
  room_filters: [
    // Insert room_filters
  ],
  member_filters: [
    // Insert member_filters
  ],
  controls: [
    // Add additional controls
  ],
  
}

// This is the client id and secret for the plugin - used to communicate back to the Spark Engine. These are issued per plugin
const clientId = "VATOM_PLATFORM_CLIENTID";
const clientSecret = "VATOM_PLATFORM_CLIENTSECRET";

const spark = new Spark(descriptor, clientId, clientSecret);

spark.start();

spark.on("invalidEvent", (e: any) => {});

spark.on("get.facades.message", async () => {
  return descriptor.facades.message;
});

spark.on("get.descriptor", async () => {
  //event to return descriptor in order to cache it
  return descriptor;
});

```

## Documentation

### Descriptor

The descriptor describes how the plugin behaves within the Vatom Wallet. 

#### Message Facades

Registering a message facade tells the Vatom Platform what messages your plugin is interested in. For example, the following will register a 'm.room.message' facade with corresponding name & actions:

```js
{
    id: "m.room.message",
    actions: ["reply", "react", "flag"],
    name: "Post",
}
```

As a result, the plugin will be called whenever a m.room.message received a reply, react or flag event - allowing the plugin to respond appropriately

#### Modal Facades

Registering a modal facade tells the Vatom Platform what modals your plugin is interested in. For example, the following will register a 'v.room.topic' facade with corresponding name & event:

```js
{
    event: "message.new",
    name: "New Topic",
    message_type: "v.room.topic",
}
```

As a result, the plugin will be called whenever a new v.room.topic needs to be rendered - allowing the plugin to respond appropriately

### Rendering Events

When facades are loaded, the wallet will send an event to the plugin. The plugin can then return a JSON document containing the configuration of the Facade. 

Facades are a hierarchical JSON document composed of Elements that allows users to describe a UI component made up of paragraphs, text, input fields, buttons, etc. This is not unlike HTML but has no style component as the style is provided by the application, not by the plugin provider.

```js
// Listens to the display event from a message
spark.on("message.new", async (data: any) => {
    console.info("Received message.new", data);

    const { messageTypes } = data;
    return messageTypes.map((messageType: string) => {
        if (messageType === "m.room.message") {
            return {
                type: messageType,
                inputs: [
                {
                    type: "text",
                    placeholder: "Description",
                },
                ],
            };
        }
    });
});
```

When a new message of type m.room.message needs to be created the UI will render a simple text input field asking the user for a Description

### System Events

The system also generates events when user interacts with the system. For example:

```js
// Called when a user posts a message
spark.on("m.room.message", async (message: any) => {
  // Look for posted replies with a vote
  // Call the backend to increment the score
  console.info("Received message", message);
});
```