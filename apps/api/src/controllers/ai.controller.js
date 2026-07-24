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
/*
|--------------------------------------------------------------------------
| AI CONTROLLER
|--------------------------------------------------------------------------
| Part 2
|
| Responsibilities:
|
| - Resolve authenticated merchant/shop
| - Resolve visitor
| - Resolve conversation
| - Validate subscription
| - Verify resource ownership
| - Prevent cross-shop conversation access
| - Build secure AI request context
|--------------------------------------------------------------------------
*/

import mongoose from "mongoose";

import Shop from "../../models/shop.js";
import Visitor from "../../models/Visitor.js";
import Conversation from "../../models/Conversation.js";
import Subscription from "../../models/Subscription.js";

import AIService from "../../services/ai/ai.service.js";

import logger from "../../config/logger.js";

/*
|--------------------------------------------------------------------------
| Validate MongoDB ObjectId
|--------------------------------------------------------------------------
*/

function isValidObjectId(id) {

    return Boolean(

        id &&

        mongoose.Types.ObjectId.isValid(id)

    );

}

/*
|--------------------------------------------------------------------------
| Get Request Shop ID
|--------------------------------------------------------------------------
|
| Priority:
|
| 1. req.shop
| 2. req.user.shop
| 3. req.body.shopId
| 4. req.params.shopId
|
| Never trust client-provided IDs when authenticated
| context already provides a verified shop.
|--------------------------------------------------------------------------
*/

function resolveShopId(req) {

    if (req.shop?._id) {

        return req.shop._id;

    }

    if (req.user?.shop?._id) {

        return req.user.shop._id;

    }

    if (req.user?.shopId) {

        return req.user.shopId;

    }

    if (req.body?.shopId) {

        return req.body.shopId;

    }

    if (req.params?.shopId) {

        return req.params.shopId;

    }

    return null;

}

/*
|--------------------------------------------------------------------------
| Resolve Visitor ID
|--------------------------------------------------------------------------
*/

function resolveVisitorId(req) {

    return (

        req.visitor?._id ||

        req.body?.visitorId ||

        req.body?.visitor?._id ||

        req.params?.visitorId ||

        null

    );

}

/*
|--------------------------------------------------------------------------
| Resolve Conversation ID
|--------------------------------------------------------------------------
*/

function resolveConversationId(req) {

    return (

        req.body?.conversationId ||

        req.params?.conversationId ||

        req.conversation?._id ||

        null

    );

}

/*
|--------------------------------------------------------------------------
| Load Shop
|--------------------------------------------------------------------------
*/

export async function resolveShop(req) {

    const shopId = resolveShopId(req);

    if (!shopId) {

        const error = new Error(

            "Shop context is required."

        );

        error.statusCode = 400;

        error.code = "SHOP_CONTEXT_REQUIRED";

        throw error;

    }

    if (!isValidObjectId(shopId)) {

        const error = new Error(

            "Invalid shop ID."

        );

        error.statusCode = 400;

        error.code = "INVALID_SHOP_ID";

        throw error;

    }

    /*
    |--------------------------------------------------------------------------
    | If authentication middleware already loaded the shop,
    | use the verified document.
    |--------------------------------------------------------------------------
    */

    if (

        req.shop &&

        String(req.shop._id) === String(shopId)

    ) {

        return req.shop;

    }

    const shop = await Shop.findById(

        shopId

    ).lean();

    if (!shop) {

        const error = new Error(

            "Shop not found."

        );

        error.statusCode = 404;

        error.code = "SHOP_NOT_FOUND";

        throw error;

    }

    return shop;

}

/*
|--------------------------------------------------------------------------
| Validate Shop Status
|--------------------------------------------------------------------------
*/

export function validateShopStatus(shop) {

    if (!shop) {

        const error = new Error(

            "Shop not found."

        );

        error.statusCode = 404;

        error.code = "SHOP_NOT_FOUND";

        throw error;

    }

    /*
    |--------------------------------------------------------------------------
    | Block deleted shops
    |--------------------------------------------------------------------------
    */

    if (

        shop.deleted === true ||

        shop.isDeleted === true

    ) {

        const error = new Error(

            "This store is no longer available."

        );

        error.statusCode = 403;

        error.code = "SHOP_DELETED";

        throw error;

    }

    /*
    |--------------------------------------------------------------------------
    | Block disabled shops
    |--------------------------------------------------------------------------
    */

    if (

        shop.status &&

        ![

            "active",

            "trial",

            "past_due"

        ].includes(

            String(shop.status).toLowerCase()

        )

    ) {

        const error = new Error(

            "This store is currently unavailable."

        );

        error.statusCode = 403;

        error.code = "SHOP_INACTIVE";

        throw error;

    }

    return true;

}

/*
|--------------------------------------------------------------------------
| Load Subscription
|--------------------------------------------------------------------------
*/

export async function resolveSubscription(

    shop

) {

    if (!shop?._id) {

        const error = new Error(

            "Shop is required to resolve subscription."

        );

        error.statusCode = 400;

        error.code = "SHOP_REQUIRED";

        throw error;

    }

    /*
    |--------------------------------------------------------------------------
    | Use populated subscription if already available.
    |--------------------------------------------------------------------------
    */

    if (

        shop.subscription &&

        typeof shop.subscription === "object" &&

        shop.subscription._id

    ) {

        return shop.subscription;

    }

    /*
    |--------------------------------------------------------------------------
    | Resolve subscription from shop reference.
    |--------------------------------------------------------------------------
    */

    if (shop.subscription) {

        const subscription =

            await Subscription.findById(

                shop.subscription

            ).lean();

        if (subscription) {

            return subscription;

        }

    }

    /*
    |--------------------------------------------------------------------------
    | Fallback:
    | Find the current subscription belonging to this shop.
    |--------------------------------------------------------------------------
    |
    | The exact subscription status field should match
    | the finalized Subscription model.
    |--------------------------------------------------------------------------
    */

    const subscription =

        await Subscription.findOne({

            shop: shop._id

        })

        .sort({

            createdAt: -1

        })

        .lean();

    if (!subscription) {

        const error = new Error(

            "Subscription not found."

        );

        error.statusCode = 402;

        error.code = "SUBSCRIPTION_NOT_FOUND";

        throw error;

    }

    return subscription;

}

/*
|--------------------------------------------------------------------------
| Validate AI Subscription
|--------------------------------------------------------------------------
*/

export function validateAISubscription(

    subscription

) {

    /*
    |--------------------------------------------------------------------------
    | Use the finalized AIService subscription validation.
    |--------------------------------------------------------------------------
    */

    AIService.validateSubscription(

        subscription

    );

    /*
    |--------------------------------------------------------------------------
    | Additional trial expiration check.
    |--------------------------------------------------------------------------
    |
    | This prevents an expired trial from continuing to
    | access the AI service if isActive was not synchronized.
    |--------------------------------------------------------------------------
    */

    if (

        subscription.trialEndsAt &&

        new Date(

            subscription.trialEndsAt

        ).getTime() < Date.now()

    ) {

        const error = new Error(

            "Your free trial has expired."

        );

        error.statusCode = 402;

        error.code = "TRIAL_EXPIRED";

        throw error;

    }

    return true;

}

/*
|--------------------------------------------------------------------------
| Resolve Visitor
|--------------------------------------------------------------------------
*/

export async function resolveVisitor(

    req,

    shop

) {

    const visitorId = resolveVisitorId(req);

    /*
    |--------------------------------------------------------------------------
    | Visitor is optional for some internal AI endpoints.
    |--------------------------------------------------------------------------
    */

    if (!visitorId) {

        return null;

    }

    if (!isValidObjectId(visitorId)) {

        const error = new Error(

            "Invalid visitor ID."

        );

        error.statusCode = 400;

        error.code = "INVALID_VISITOR_ID";

        throw error;

    }

    /*
    |--------------------------------------------------------------------------
    | Use verified request visitor when available.
    |--------------------------------------------------------------------------
    */

    if (

        req.visitor &&

        String(req.visitor._id) === String(visitorId)

    ) {

        return req.visitor;

    }

    const visitor =

        await Visitor.findOne({

            _id: visitorId,

            shop: shop._id

        })

        .lean();

    if (!visitor) {

        const error = new Error(

            "Visitor not found."

        );

        error.statusCode = 404;

        error.code = "VISITOR_NOT_FOUND";

        throw error;

    }

    return visitor;

}

/*
|--------------------------------------------------------------------------
| Resolve Conversation
|--------------------------------------------------------------------------
*/

export async function resolveConversation(

    req,

    shop,

    visitor = null

) {

    const conversationId =

        resolveConversationId(req);

    /*
    |--------------------------------------------------------------------------
    | No conversation supplied.
    |--------------------------------------------------------------------------
    |
    | The chat controller can create a new conversation
    | in the next part.
    |--------------------------------------------------------------------------
    */

    if (!conversationId) {

        return null;

    }

    if (!isValidObjectId(conversationId)) {

        const error = new Error(

            "Invalid conversation ID."

        );

        error.statusCode = 400;

        error.code = "INVALID_CONVERSATION_ID";

        throw error;

    }

    /*
    |--------------------------------------------------------------------------
    | IMPORTANT SECURITY RULE
    |--------------------------------------------------------------------------
    |
    | Conversation must belong to the requested shop.
    |--------------------------------------------------------------------------
    */

    const query = {

        _id: conversationId,

        shop: shop._id

    };

    /*
    |--------------------------------------------------------------------------
    | If visitor context exists, enforce visitor ownership.
    |--------------------------------------------------------------------------
    */

    if (visitor?._id) {

        query.visitor = visitor._id;

    }

    const conversation =

        await Conversation.findOne(

            query

        )

        .populate("shop")

        .populate("visitor")

        .populate("subscription");

    if (!conversation) {

        const error = new Error(

            "Conversation not found or access denied."

        );

        error.statusCode = 404;

        error.code = "CONVERSATION_NOT_FOUND";

        throw error;

    }

    return conversation;

}

/*
|--------------------------------------------------------------------------
| Validate Conversation Ownership
|--------------------------------------------------------------------------
*/

export function validateConversationOwnership({

    conversation,

    shop,

    visitor

}) {

    if (!conversation) {

        return true;

    }

    /*
    |--------------------------------------------------------------------------
    | Shop ownership
    |--------------------------------------------------------------------------
    */

    if (

        !conversation.shop ||

        String(

            conversation.shop._id ||

            conversation.shop

        ) !== String(shop._id)

    ) {

        const error = new Error(

            "Conversation does not belong to this shop."

        );

        error.statusCode = 403;

        error.code = "CONVERSATION_SHOP_MISMATCH";

        throw error;

    }

    /*
    |--------------------------------------------------------------------------
    | Visitor ownership
    |--------------------------------------------------------------------------
    |
    | Only enforce when visitor context is available.
    |--------------------------------------------------------------------------
    */

    if (

        visitor &&

        conversation.visitor &&

        String(

            conversation.visitor._id ||

            conversation.visitor

        ) !== String(visitor._id)

    ) {

        const error = new Error(

            "Conversation does not belong to this visitor."

        );

        error.statusCode = 403;

        error.code = "CONVERSATION_VISITOR_MISMATCH";

        throw error;

    }

    return true;

}

/*
|--------------------------------------------------------------------------
| Build AI Request Context
|--------------------------------------------------------------------------
|
| This function centralizes all validated resources needed
| by the chat controller.
|--------------------------------------------------------------------------
*/

export async function buildAIRequestContext(

    req

) {

    /*
    |--------------------------------------------------------------------------
    | 1. Resolve Shop
    |--------------------------------------------------------------------------
    */

    const shop =

        await resolveShop(req);

    validateShopStatus(shop);

    /*
    |--------------------------------------------------------------------------
    | 2. Resolve Subscription
    |--------------------------------------------------------------------------
    */

    const subscription =

        await resolveSubscription(shop);

    validateAISubscription(

        subscription

    );

    /*
    |--------------------------------------------------------------------------
    | 3. Resolve Visitor
    |--------------------------------------------------------------------------
    */

    const visitor =

        await resolveVisitor(

            req,

            shop

        );

    /*
    |--------------------------------------------------------------------------
    | 4. Resolve Conversation
    |--------------------------------------------------------------------------
    */

    const conversation =

        await resolveConversation(

            req,

            shop,

            visitor

        );

    /*
    |--------------------------------------------------------------------------
    | 5. Verify Ownership
    |--------------------------------------------------------------------------
    */

    validateConversationOwnership({

        conversation,

        shop,

        visitor

    });

    /*
    |--------------------------------------------------------------------------
    | Return secure context
    |--------------------------------------------------------------------------
    */

    return {

        shop,

        subscription,

        visitor,

        conversation

    };

}

/*
|--------------------------------------------------------------------------
| Check AI Token Availability
|--------------------------------------------------------------------------
*/

export function checkAITokenAvailability({

    subscription,

    estimatedTokens = 0

}) {

    const availability =

        AIService.checkTokenAvailability(

            subscription,

            estimatedTokens

        );

    if (!availability.allowed) {

        const error = new Error(

            "Monthly AI token limit has been reached."

        );

        error.statusCode = 429;

        error.code = "AI_TOKEN_LIMIT_REACHED";

        error.details = {

            limit:

                availability.limit,

            used:

                subscription.monthlyTokensUsed || 0,

            remaining:

                availability.remaining

        };

        throw error;

    }

    return availability;

}

/*
|--------------------------------------------------------------------------
| Log Resolved AI Context
|--------------------------------------------------------------------------
*/

export function logAIContext({

    shop,

    subscription,

    visitor,

    conversation

}) {

    logger.info(

        "AI request context resolved",

        {

            shopId:

                shop?._id,

            subscriptionId:

                subscription?._id,

            plan:

                subscription?.plan,

            visitorId:

                visitor?._id || null,

            conversationId:

                conversation?._id || null

        }

    );

}
