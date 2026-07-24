/*
|--------------------------------------------------------------------------
| controllers/ai.controller.js
|--------------------------------------------------------------------------
|
| Layboka AI — Production AI Controller
|
| Responsibilities:
|
| 1. Validate incoming AI requests
| 2. Resolve authenticated shop
| 3. Resolve visitor
| 4. Resolve conversation
| 5. Validate subscription
| 6. Delegate AI processing to AIService
|
| IMPORTANT:
| The controller does NOT contain OpenAI business logic.
| All AI orchestration belongs to ai.service.js.
|
|--------------------------------------------------------------------------
*/

import crypto from "crypto";

import AIService from "../services/ai/ai.service.js";

import Shop from "../models/shop.js";
import Visitor from "../models/Visitor.js";
import Conversation from "../models/Conversation.js";
import Subscription from "../models/Subscription.js";

import logger from "../config/logger.js";


/*
|--------------------------------------------------------------------------
| Controller Configuration
|--------------------------------------------------------------------------
*/

export const AI_CONTROLLER_CONFIG = Object.freeze({

    MAX_MESSAGE_LENGTH: 10000,

    DEFAULT_PAGE_TYPE: "homepage",

    DEFAULT_CURRENCY: "USD",

    DEFAULT_LANGUAGE: "English",

    DEFAULT_CONVERSATION_STATUS: "active"

});


/*
|--------------------------------------------------------------------------
| Utility — Get Request Value
|--------------------------------------------------------------------------
|
| Safely retrieves a value from:
|
| req.body
| req.params
| req.query
|
|--------------------------------------------------------------------------
*/

function getRequestValue(

    req,

    key

) {

    return (

        req.body?.[key] ??

        req.params?.[key] ??

        req.query?.[key] ??

        null

    );

}


/*
|--------------------------------------------------------------------------
| Utility — Normalize ID
|--------------------------------------------------------------------------
*/

function normalizeId(value) {

    if (!value) {

        return null;

    }

    return String(value);

}


/*
|--------------------------------------------------------------------------
| Validate AI Message
|--------------------------------------------------------------------------
*/

export function validateAIMessage(

    message

) {

    if (

        message === null ||

        message === undefined

    ) {

        return {

            valid: false,

            error: "Message is required."

        };

    }

    if (

        typeof message !== "string"

    ) {

        return {

            valid: false,

            error: "Message must be a string."

        };

    }

    const trimmedMessage =

        message.trim();

    if (!trimmedMessage) {

        return {

            valid: false,

            error: "Message cannot be empty."

        };

    }

    if (

        trimmedMessage.length >

        AI_CONTROLLER_CONFIG.MAX_MESSAGE_LENGTH

    ) {

        return {

            valid: false,

            error:
                `Message cannot exceed ` +
                `${AI_CONTROLLER_CONFIG.MAX_MESSAGE_LENGTH} characters.`

        };

    }

    return {

        valid: true,

        message: trimmedMessage

    };

}


/*
|--------------------------------------------------------------------------
| Resolve Shop
|--------------------------------------------------------------------------
|
| Supported sources:
|
| 1. req.shop
| 2. req.user.shop
| 3. req.shopId
| 4. req.user.shopId
| 5. req.body.shopId
| 6. req.params.shopId
|
| The controller prefers an already authenticated shop object.
| Otherwise it loads the shop from MongoDB.
|
|--------------------------------------------------------------------------
*/

export async function resolveShop(

    req

) {

    /*
    |--------------------------------------------------------------------------
    | Existing Shop Object
    |--------------------------------------------------------------------------
    */

    if (req.shop) {

        return req.shop;

    }

    if (req.user?.shop) {

        return req.user.shop;

    }

    /*
    |--------------------------------------------------------------------------
    | Resolve Shop ID
    |--------------------------------------------------------------------------
    */

    const shopId =

        req.shopId ||

        req.user?.shopId ||

        getRequestValue(

            req,

            "shopId"

        );

    if (!shopId) {

        throw new Error(

            "Shop could not be identified."

        );

    }

    /*
    |--------------------------------------------------------------------------
    | Load Shop
    |--------------------------------------------------------------------------
    */

    const shop =

        await Shop.findById(

            shopId

        )

        .populate("subscription")

        .lean();

    if (!shop) {

        throw new Error(

            "Shop not found."

        );

    }

    return shop;

}


/*
|--------------------------------------------------------------------------
| Resolve Subscription
|--------------------------------------------------------------------------
*/

export async function resolveSubscription(

    shop,

    conversation = null

) {

    /*
    |--------------------------------------------------------------------------
    | Shop Subscription
    |--------------------------------------------------------------------------
    */

    if (

        shop?.subscription

    ) {

        return shop.subscription;

    }

    /*
    |--------------------------------------------------------------------------
    | Conversation Subscription
    |--------------------------------------------------------------------------
    */

    if (

        conversation?.subscription

    ) {

        return conversation.subscription;

    }

    /*
    |--------------------------------------------------------------------------
    | Subscription ID
    |--------------------------------------------------------------------------
    */

    const subscriptionId =

        shop?.subscriptionId ||

        conversation?.subscriptionId;

    if (!subscriptionId) {

        throw new Error(

            "Subscription not found."

        );

    }

    /*
    |--------------------------------------------------------------------------
    | Load Subscription
    |--------------------------------------------------------------------------
    */

    const subscription =

        await Subscription.findById(

            subscriptionId

        ).lean();

    if (!subscription) {

        throw new Error(

            "Subscription not found."

        );

    }

    return subscription;

}


/*
|--------------------------------------------------------------------------
| Validate Shop Subscription
|--------------------------------------------------------------------------
*/

export function validateShopSubscription(

    subscription

) {

    if (!subscription) {

        throw new Error(

            "Active subscription is required."

        );

    }

    if (

        subscription.isActive !== true

    ) {

        throw new Error(

            "Subscription is inactive."

        );

    }

    return true;

}


/*
|--------------------------------------------------------------------------
| Resolve Visitor
|--------------------------------------------------------------------------
|
| The visitor may already be attached by middleware.
|
| Otherwise we try to resolve visitorId from the request.
|
|--------------------------------------------------------------------------
*/

export async function resolveVisitor(

    req

) {

    /*
    |--------------------------------------------------------------------------
    | Existing Visitor Object
    |--------------------------------------------------------------------------
    */

    if (req.visitor) {

        return req.visitor;

    }

    /*
    |--------------------------------------------------------------------------
    | Visitor ID
    |--------------------------------------------------------------------------
    */

    const visitorId =

        req.visitorId ||

        req.user?.visitorId ||

        getRequestValue(

            req,

            "visitorId"

        );

    if (!visitorId) {

        return null;

    }

    /*
    |--------------------------------------------------------------------------
    | Load Visitor
    |--------------------------------------------------------------------------
    */

    const visitor =

        await Visitor.findById(

            visitorId

        ).lean();

    return visitor || null;

}


/*
|--------------------------------------------------------------------------
| Resolve Conversation
|--------------------------------------------------------------------------
|
| If conversationId exists:
|     Load existing conversation.
|
| If no conversationId:
|     Create a new conversation.
|
|--------------------------------------------------------------------------
*/

export async function resolveConversation({

    req,

    shop,

    visitor,

    subscription

}) {

    /*
    |--------------------------------------------------------------------------
    | Conversation ID
    |--------------------------------------------------------------------------
    */

    const conversationId =

        getRequestValue(

            req,

            "conversationId"

        );

    /*
    |--------------------------------------------------------------------------
    | Load Existing Conversation
    |--------------------------------------------------------------------------
    */

    if (conversationId) {

        const conversation =

            await Conversation.findById(

                conversationId

            )

            .populate("shop")

            .populate("visitor")

            .populate("subscription");

        if (!conversation) {

            throw new Error(

                "Conversation not found."

            );

        }

        /*
        |--------------------------------------------------------------------------
        | Verify Conversation Belongs To Shop
        |--------------------------------------------------------------------------
        */

        if (

            conversation.shop &&

            String(

                conversation.shop._id

            ) !== String(

                shop._id

            )

        ) {

            throw new Error(

                "Conversation does not belong to this shop."

            );

        }

        return conversation;

    }

    /*
    |--------------------------------------------------------------------------
    | Create New Conversation
    |--------------------------------------------------------------------------
    */

    const conversationData = {

        shop:
            shop._id,

        subscription:
            subscription?._id ||

            subscription?.id ||

            null,

        visitor:
            visitor?._id ||

            visitor?.id ||

            null,

        conversationId:
            crypto.randomUUID(),

        status:
            AI_CONTROLLER_CONFIG
                .DEFAULT_CONVERSATION_STATUS,

        totalMessages:
            0,

        aiMessages:
            0,

        promptTokens:
            0,

        completionTokens:
            0,

        totalTokens:
            0,

        estimatedCost:
            0,

        apiCalls:
            0,

        averageResponseTime:
            0,

        lastMessageAt:
            new Date()

    };

    const conversation =

        await Conversation.create(

            conversationData

        );

    return conversation;

}


/*
|--------------------------------------------------------------------------
| Resolve Current Page
|--------------------------------------------------------------------------
*/

export function resolveCurrentPage(

    req

) {

    const page =

        req.body?.currentPage ||

        req.body?.page ||

        {};

    return {

        type:
            page.type ||

            AI_CONTROLLER_CONFIG
                .DEFAULT_PAGE_TYPE,

        title:
            page.title || "",

        url:
            page.url || "",

        productTitle:
            page.productTitle || "",

        collectionTitle:
            page.collectionTitle || ""

    };

}


/*
|--------------------------------------------------------------------------
| Resolve Cart
|--------------------------------------------------------------------------
*/

export function resolveCart(

    req

) {

    const cart =

        req.body?.cart ||

        {};

    return {

        items:
            Array.isArray(

                cart.items

            )

                ? cart.items

                : [],

        itemCount:
            cart.itemCount ||

            cart.items?.length ||

            0,

        subtotal:
            cart.subtotal ||

            0,

        discount:
            cart.discount ||

            0,

        total:
            cart.total ||

            cart.subtotal ||

            0,

        checkoutUrl:
            cart.checkoutUrl ||

            "",

        currency:
            cart.currency ||

            AI_CONTROLLER_CONFIG
                .DEFAULT_CURRENCY

    };

}


/*
|--------------------------------------------------------------------------
| Resolve Current Product
|--------------------------------------------------------------------------
*/

export function resolveCurrentProduct(

    req

) {

    return (

        req.body?.currentProduct ||

        req.body?.product ||

        null

    );

}


/*
|--------------------------------------------------------------------------
| Resolve Request Context
|--------------------------------------------------------------------------
*/

export function resolveAIRequestContext(

    req

) {

    return {

        message:

            getRequestValue(

                req,

                "message"

            ),

        conversationId:

            getRequestValue(

                req,

                "conversationId"

            ),

        visitorId:

            getRequestValue(

                req,

                "visitorId"

            ),

        shopId:

            getRequestValue(

                req,

                "shopId"

            ),

        currentPage:

            resolveCurrentPage(

                req

            ),

        cart:

            resolveCart(

                req

            ),

        currentProduct:

            resolveCurrentProduct(

                req

            )

    };

}
