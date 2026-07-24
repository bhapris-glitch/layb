/*
|--------------------------------------------------------------------------
| controllers/ai.controller.js
|--------------------------------------------------------------------------
| Layboka AI
| Shopify AI Sales Executive
|--------------------------------------------------------------------------
|
| Responsibilities:
|
| 1. Receive AI chat requests
| 2. Validate shop / visitor / conversation
| 3. Create conversation when required
| 4. Save visitor messages
| 5. Call AIService
| 6. Save assistant responses
| 7. Return recommendations
| 8. Handle streaming responses
| 9. Handle subscription validation
| 10. Handle human handoff
|
|--------------------------------------------------------------------------
*/

import crypto from "crypto";

import AIService, {
    analyzeCustomerIntent,
    generateRecommendations,
    buildPrompt,
    buildAIContext,
    requestAI,
    formatResponse,
    calculateTokenUsage,
    calculateCost,
    buildProductCards,
    buildQuickReplies,
    buildActions,
    buildCartRecovery,
    buildUpsellResponse,
    buildCrossSellResponse,
    saveAssistantMessage,
    updateConversationAfterResponse,
    updateConversationAnalytics,
    updateCustomerMemory,
    buildPerformanceMetrics
} from "../services/ai.service.js";

import ConversationService from "../services/conversation.service.js";

import Shop from "../../models/shop.js";
import Visitor from "../../models/Visitor.js";
import Conversation from "../../models/Conversation.js";
import Message from "../../models/Message.js";
import Subscription from "../../models/Subscription.js";

import logger from "../../config/logger.js";


/*
|--------------------------------------------------------------------------
| Helper: Get Request User
|--------------------------------------------------------------------------
*/

function getRequestUser(req) {

    return (
        req.user ||
        req.merchant ||
        req.admin ||
        null
    );

}


/*
|--------------------------------------------------------------------------
| Helper: Get Shop ID
|--------------------------------------------------------------------------
*/

function getShopId(req) {

    return (
        req.body?.shopId ||
        req.params?.shopId ||
        req.query?.shopId ||
        req.shop?._id ||
        req.user?.shopId ||
        null
    );

}


/*
|--------------------------------------------------------------------------
| Helper: Get Visitor ID
|--------------------------------------------------------------------------
*/

function getVisitorId(req) {

    return (
        req.body?.visitorId ||
        req.body?.visitor?.id ||
        req.params?.visitorId ||
        req.query?.visitorId ||
        req.visitor?._id ||
        null
    );

}


/*
|--------------------------------------------------------------------------
| Helper: Get Conversation ID
|--------------------------------------------------------------------------
*/

function getConversationId(req) {

    return (
        req.body?.conversationId ||
        req.params?.conversationId ||
        req.query?.conversationId ||
        null
    );

}


/*
|--------------------------------------------------------------------------
| Helper: Normalize Error
|--------------------------------------------------------------------------
*/

function getErrorMessage(error) {

    return (
        error?.message ||
        "AI request failed."
    );

}


/*
|--------------------------------------------------------------------------
| Helper: Send Error
|--------------------------------------------------------------------------
*/

function sendError(

    res,

    error,

    statusCode = 500

) {

    logger.error(

        "AI Controller Error",

        {

            message: error?.message,

            stack: error?.stack

        }

    );

    return res.status(statusCode).json({

        success: false,

        error: getErrorMessage(error)

    });

}


/*
|--------------------------------------------------------------------------
| Helper: Validate Shop
|--------------------------------------------------------------------------
*/

async function loadShop(shopId) {

    if (!shopId) {

        throw new Error(

            "Shop ID is required."

        );

    }

    const shop =

        await Shop.findById(shopId);

    if (!shop) {

        throw new Error(

            "Shop not found."

        );

    }

    return shop;

}


/*
|--------------------------------------------------------------------------
| Helper: Validate Visitor
|--------------------------------------------------------------------------
*/

async function loadVisitor(visitorId) {

    if (!visitorId) {

        throw new Error(

            "Visitor ID is required."

        );

    }

    const visitor =

        await Visitor.findById(

            visitorId

        );

    if (!visitor) {

        throw new Error(

            "Visitor not found."

        );

    }

    return visitor;

}


/*
|--------------------------------------------------------------------------
| Helper: Validate Subscription
|--------------------------------------------------------------------------
*/

async function validateShopSubscription(shop) {

    let subscription =

        shop.subscription || null;

    /*
    |--------------------------------------------------------------------------
    | If subscription is already populated
    |--------------------------------------------------------------------------
    */

    if (

        subscription &&

        typeof subscription === "object" &&

        subscription.plan

    ) {

        AIService.validateSubscription(

            subscription

        );

        return subscription;

    }

    /*
    |--------------------------------------------------------------------------
    | Try subscription ID
    |--------------------------------------------------------------------------
    */

    const subscriptionId =

        shop.subscription?._id ||

        shop.subscriptionId ||

        null;

    if (subscriptionId) {

        subscription =

            await Subscription.findById(

                subscriptionId

            );

    }

    /*
    |--------------------------------------------------------------------------
    | Try shop subscription query
    |--------------------------------------------------------------------------
    */

    if (!subscription) {

        subscription =

            await Subscription.findOne({

                shop: shop._id,

                isActive: true

            }).sort({

                createdAt: -1

            });

    }

    AIService.validateSubscription(

        subscription

    );

    return subscription;

}


/*
|--------------------------------------------------------------------------
| Helper: Load Conversation
|--------------------------------------------------------------------------
*/

async function loadOrCreateConversation({

    conversationId,

    shop,

    visitor,

    req

}) {

    /*
    |--------------------------------------------------------------------------
    | Existing Conversation
    |--------------------------------------------------------------------------
    */

    if (conversationId) {

        const conversation =

            await Conversation.findById(

                conversationId

            );

        if (!conversation) {

            throw new Error(

                "Conversation not found."

            );

        }

        /*
        |--------------------------------------------------------------------------
        | Security Validation
        |--------------------------------------------------------------------------
        */

        if (

            String(conversation.shop) !==

            String(shop._id)

        ) {

            throw new Error(

                "Conversation does not belong to this shop."

            );

        }

        if (

            String(conversation.visitor) !==

            String(visitor._id)

        ) {

            throw new Error(

                "Conversation does not belong to this visitor."

            );

        }

        return conversation;

    }

    /*
    |--------------------------------------------------------------------------
    | Find Existing Active Conversation
    |--------------------------------------------------------------------------
    */

    const existing =

        await ConversationService

            .findActiveConversation({

                shopId: shop._id,

                visitorId: visitor._id

            });

    if (existing) {

        return existing;

    }

    /*
    |--------------------------------------------------------------------------
    | Create New Conversation
    |--------------------------------------------------------------------------
    */

    const subscription =

        await validateShopSubscription(

            shop

        );

    return ConversationService

        .createConversation({

            shopId: shop._id,

            visitorId: visitor._id,

            merchantId:

                req.user?._id ||

                req.merchant?._id ||

                null,

            subscriptionId:

                subscription._id

        });

}


/*
|--------------------------------------------------------------------------
| Helper: Save Visitor Message
|--------------------------------------------------------------------------
*/

async function saveVisitorMessage({

    conversation,

    shop,

    visitor,

    content

}) {

    return ConversationService.addMessage({

        conversation,

        message: {

            role: "visitor",

            messageType: "text",

            messageId:

                crypto.randomUUID(),

            sequence:

                conversation.totalMessages + 1,

            content,

            sender: {

                senderType: "visitor",

                name:

                    visitor.name ||

                    "Customer",

                source: "shopify-widget"

            },

            delivery: {

                status: "sent",

                deliveredAt:

                    new Date()

            }

        }

    });

}


/*
|--------------------------------------------------------------------------
| POST /api/ai/chat
|--------------------------------------------------------------------------
*/

export async function chat(req, res) {

    const startedAt =

        Date.now();

    try {

        const {

            message,

            stream = false,

            currentPage = {},

            currentProduct = null,

            cart = {},

            customer = {},

            merchant = {},

            policies = {},

            brand = {},

            collection = {}

        } = req.body || {};

        /*
        |--------------------------------------------------------------------------
        | Validate Message
        |--------------------------------------------------------------------------
        */

        if (

            !message ||

            typeof message !== "string" ||

            !message.trim()

        ) {

            return res.status(400).json({

                success: false,

                error:

                    "Message is required."

            });

        }

        /*
        |--------------------------------------------------------------------------
        | Load IDs
        |--------------------------------------------------------------------------
        */

        const shopId =

            getShopId(req);

        const visitorId =

            getVisitorId(req);

        const conversationId =

            getConversationId(req);

        /*
        |--------------------------------------------------------------------------
        | Load Shop
        |--------------------------------------------------------------------------
        */

        const shop =

            await loadShop(shopId);

        /*
        |--------------------------------------------------------------------------
        | Load Visitor
        |--------------------------------------------------------------------------
        */

        const visitor =

            await loadVisitor(

                visitorId

            );

        /*
        |--------------------------------------------------------------------------
        | Validate Subscription
        |--------------------------------------------------------------------------
        */

        const subscription =

            await validateShopSubscription(

                shop

            );

        /*
        |--------------------------------------------------------------------------
        | Load/Create Conversation
        |--------------------------------------------------------------------------
        */

        const conversation =

            await loadOrCreateConversation({

                conversationId,

                shop,

                visitor,

                req

            });

        /*
        |--------------------------------------------------------------------------
        | Save Visitor Message
        |--------------------------------------------------------------------------
        */

        await saveVisitorMessage({

            conversation,

            shop,

            visitor,

            content:

                message.trim()

        });

        /*
        |--------------------------------------------------------------------------
        | Analyze Intent
        |--------------------------------------------------------------------------
        */

        const intent =

            await analyzeCustomerIntent({

                conversation,

                message:

                    message.trim()

            });

        /*
        |--------------------------------------------------------------------------
        | Generate Recommendations
        |--------------------------------------------------------------------------
        */

        const recommendations =

            await generateRecommendations({

                conversation,

                shop,

                currentProduct,

                cartItems:

                    cart.items || []

            });

        /*
        |--------------------------------------------------------------------------
        | Build Product Cards
        |--------------------------------------------------------------------------
        */

        const productCards =

            buildProductCards(

                recommendations

            );

        /*
        |--------------------------------------------------------------------------
        | Build Quick Replies
        |--------------------------------------------------------------------------
        */

        const quickReplies =

            buildQuickReplies(

                intent.intent

            );

        /*
        |--------------------------------------------------------------------------
        | Build Actions
        |--------------------------------------------------------------------------
        */

        const actions =

            buildActions(

                recommendations

            );

        /*
        |--------------------------------------------------------------------------
        | Cart Recovery
        |--------------------------------------------------------------------------
        */

        const cartRecovery =

            buildCartRecovery(

                cart

            );

        /*
        |--------------------------------------------------------------------------
        | Build Prompt
        |--------------------------------------------------------------------------
        */

        const systemPrompt =

            await buildPrompt({

                plan:

                    subscription.plan,

                merchant,

                shop,

                customer,

                conversation,

                products:

                    recommendations,

                currentPage,

                cart

            });

        /*
        |--------------------------------------------------------------------------
        | Build User Input
        |--------------------------------------------------------------------------
        */

        const input = [

            {

                role: "user",

                content:

                    message.trim()

            }

        ];

        /*
        |--------------------------------------------------------------------------
        | Streaming Response
        |--------------------------------------------------------------------------
        */

        if (stream) {

            return streamChatResponse({

                req,

                res,

                shop,

                visitor,

                conversation,

                subscription,

                systemPrompt,

                input,

                productCards,

                quickReplies,

                actions,

                cartRecovery,

                startedAt

            });

        }

        /*
        |--------------------------------------------------------------------------
        | Token Limit
        |--------------------------------------------------------------------------
        */

        const maxTokens =

            AIService.getTokenLimit(

                subscription.plan

            );

        /*
        |--------------------------------------------------------------------------
        | Token Availability
        |--------------------------------------------------------------------------
        */

        const tokenCheck =

            AIService.checkTokenAvailability(

                subscription,

                maxTokens

            );

        if (!tokenCheck.allowed) {

            return res.status(402).json({

                success: false,

                error:

                    "Monthly AI usage limit reached.",

                usage: {

                    used:

                        subscription.monthlyTokensUsed ||

                        0,

                    remaining:

                        tokenCheck.remaining,

                    limit:

                        tokenCheck.limit

                }

            });

        }

        /*
        |--------------------------------------------------------------------------
        | AI Request
        |--------------------------------------------------------------------------
        */

        const aiResult =

            await requestAI({

                shop: {

                    ...shop.toObject(),

                    subscription

                },

                user:

                    getRequestUser(req),

                messages:

                    input,

                temperature:

                    AIService.constructor?.AI_CONFIG

                        ?.TEMPERATURE ||

                    0.7,

                maxTokens,

                responseFormat:

                    null

            });

        /*
        |--------------------------------------------------------------------------
        | Response Time
        |--------------------------------------------------------------------------
        */

        const finishedAt =

            Date.now();

        /*
        |--------------------------------------------------------------------------
        | Calculate Usage
        |--------------------------------------------------------------------------
        */

        const usage =

            calculateTokenUsage(

                aiResult.usage

            );

        /*
        |--------------------------------------------------------------------------
        | Calculate Cost
        |--------------------------------------------------------------------------
        */

        const cost =

            calculateCost(

                aiResult.model,

                aiResult.usage

            );

        /*
        |--------------------------------------------------------------------------
        | Performance Metrics
        |--------------------------------------------------------------------------
        */

        const metrics =

            buildPerformanceMetrics({

                startedAt,

                finishedAt,

                usage:

                    aiResult.usage,

                model:

                    aiResult.model

            });

        /*
        |--------------------------------------------------------------------------
        | Save Assistant Message
        |--------------------------------------------------------------------------
        */

        const assistantMessage =

            await saveAssistantMessage({

                conversation,

                shop,

                visitor,

                content:

                    aiResult.content,

                ai: {

                    model:

                        aiResult.model,

                    provider:

                        "openai",

                    promptTokens:

                        usage.promptTokens,

                    completionTokens:

                        usage.completionTokens,

                    totalTokens:

                        usage.totalTokens,

                    estimatedCost:

                        cost.totalCost,

                    responseTime:

                        metrics.responseTime,

                    finishReason:

                        aiResult.finishReason

                },

                recommendations:

                    productCards,

                actions,

                quickReplies

            });

        /*
        |--------------------------------------------------------------------------
        | Update Conversation
        |--------------------------------------------------------------------------
        */

        await updateConversationAfterResponse({

            conversation,

            assistantMessage,

            aiUsage: {

                ...metrics,

                estimatedCost:

                    cost.totalCost

            }

        });

        /*
        |--------------------------------------------------------------------------
        | Update Analytics
        |--------------------------------------------------------------------------
        */

        await updateConversationAnalytics({

            conversation,

            recommendations:

                productCards

        });

        /*
        |--------------------------------------------------------------------------
        | Update Customer Memory
        |--------------------------------------------------------------------------
        */

        await updateCustomerMemory({

            conversation,

            visitor,

            userMessage:

                message.trim(),

            assistantMessage:

                aiResult.content

        });

        /*
        |--------------------------------------------------------------------------
        | Response
        |--------------------------------------------------------------------------
        */

        return res.status(200).json({

            ...formatResponse({

                success: true,

                content:

                    aiResult.content,

                model:

                    aiResult.model,

                provider:

                    "openai",

                finishReason:

                    aiResult.finishReason,

                usage,

                recommendations:

                    productCards,

                actions,

                quickReplies,

                metadata: {

                    conversationId:

                        conversation._id,

                    publicConversationId:

                        conversation.conversationId,

                    visitorId:

                        visitor._id,

                    shopId:

                        shop._id,

                    intent,

                    cartRecovery,

                    cost,

                    responseTime:

                        metrics.responseTime

                }

            }),

            messageId:

                assistantMessage._id

        });

    } catch (error) {

        return sendError(

            res,

            error,

            error.message?.includes(

                "Subscription"

            )

                ? 403

                : 500

        );

    }

}


/*
|--------------------------------------------------------------------------
| Streaming Chat Response
|--------------------------------------------------------------------------
*/

async function streamChatResponse({

    req,

    res,

    shop,

    visitor,

    conversation,

    subscription,

    systemPrompt,

    input,

    productCards,

    quickReplies,

    actions,

    cartRecovery,

    startedAt

}) {

    try {

        /*
        |--------------------------------------------------------------------------
        | Set Headers
        |--------------------------------------------------------------------------
        */

        res.setHeader(

            "Content-Type",

            "text/event-stream"

        );

        res.setHeader(

            "Cache-Control",

            "no-cache"

        );

        res.setHeader(

            "Connection",

            "keep-alive"

        );

        res.flushHeaders?.();

        /*
        |--------------------------------------------------------------------------
        | Get Stream
        |--------------------------------------------------------------------------
        */

        const stream =

            await AIService.openai.streamResponse({

                plan:

                    subscription.plan,

                input,

                systemPrompt,

                temperature:

                    AIService.constructor?.AI_CONFIG

                        ?.TEMPERATURE ||

                    0.7,

                maxTokens:

                    AIService.getTokenLimit(

                        subscription.plan

                    ),

                metadata: {

                    shopId:

                        String(shop._id),

                    conversationId:

                        String(conversation._id),

                    visitorId:

                        String(visitor._id)

                }

            });

        let fullContent = "";

        /*
        |--------------------------------------------------------------------------
        | Stream Events
        |--------------------------------------------------------------------------
        */

        for await (

            const event of stream

        ) {

            /*
            |--------------------------------------------------------------------------
            | Text Delta
            |--------------------------------------------------------------------------
            */

            if (

                event.type ===

                "response.output_text.delta"

            ) {

                const delta =

                    event.delta || "";

                fullContent += delta;

                res.write(

                    `data: ${JSON.stringify({

                        type: "text",

                        delta

                    })}\n\n`

                );

            }

            /*
            |--------------------------------------------------------------------------
            | Completed
            |--------------------------------------------------------------------------
            */

            if (

                event.type ===

                "response.completed"

            ) {

                const response =

                    event.response;

                const usage =

                    response?.usage || {};

                const model =

                    response?.model ||

                    AIService.getModel(

                        subscription.plan

                    );

                const metrics =

                    buildPerformanceMetrics({

                        startedAt,

                        finishedAt:

                            Date.now(),

                        usage,

                        model

                    });

                const cost =

                    calculateCost(

                        model,

                        usage

                    );

                const assistantMessage =

                    await saveAssistantMessage({

                        conversation,

                        shop,

                        visitor,

                        content:

                            fullContent,

                        ai: {

                            model,

                            provider:

                                "openai",

                            promptTokens:

                                metrics.promptTokens,

                            completionTokens:

                                metrics.completionTokens,

                            totalTokens:

                                metrics.totalTokens,

                            estimatedCost:

                                cost.totalCost,

                            responseTime:

                                metrics.responseTime

                        },

                        recommendations:

                            productCards,

                        actions,

                        quickReplies

                    });

                await updateConversationAfterResponse({

                    conversation,

                    assistantMessage,

                    aiUsage: {

                        ...metrics,

                        estimatedCost:

                            cost.totalCost

                    }

                });

                await updateConversationAnalytics({

                    conversation,

                    recommendations:

                        productCards

                });

                await updateCustomerMemory({

                    conversation,

                    visitor,

                    userMessage:

                        input?.[0]?.content ||

                        "",

                    assistantMessage:

                        fullContent

                });

                res.write(

                    `data: ${JSON.stringify({

                        type: "complete",

                        messageId:

                            assistantMessage._id,

                        conversationId:

                            conversation.conversationId,

                        recommendations:

                            productCards,

                        actions,

                        quickReplies,

                        cartRecovery,

                        usage:

                            metrics

                    })}\n\n`

                );

                res.write(

                    "data: [DONE]\n\n"

                );

                res.end();

            }

        );

    } catch (error) {

        logger.error(

            "AI Streaming Error",

            error

        );

        if (!res.headersSent) {

            return sendError(

                res,

                error,

                500

            );

        }

        res.write(

            `data: ${JSON.stringify({

                type: "error",

                error:

                    getErrorMessage(error)

            })}\n\n`

        );

        res.end();

    }

}


/*
|--------------------------------------------------------------------------
| POST /api/ai/intent
|--------------------------------------------------------------------------
*/

export async function detectIntent(req, res) {

    try {

        const {

            message,

            conversationId

        } = req.body || {};

        if (!message) {

            return res.status(400).json({

                success: false,

                error:

                    "Message is required."

            });

        }

        let conversation = null;

        if (conversationId) {

            conversation =

                await Conversation.findById(

                    conversationId

                );

        }

        const intent =

            await analyzeCustomerIntent({

                conversation,

                message

            });

        return res.json({

            success: true,

            intent

        });

    } catch (error) {

        return sendError(

            res,

            error

        );

    }

}


/*
|--------------------------------------------------------------------------
| POST /api/ai/recommendations
|--------------------------------------------------------------------------
*/

export async function recommendations(

    req,

    res

) {

    try {

        const {

            conversationId,

            shopId,

            currentProduct = null,

            cartItems = []

        } = req.body || {};

        const shop =

            await loadShop(shopId);

        const conversation =

            conversationId

                ? await Conversation.findById(

                    conversationId

                )

                : null;

        const result =

            await generateRecommendations({

                conversation,

                shop,

                currentProduct,

                cartItems

            });

        return res.json({

            success: true,

            recommendations:

                buildProductCards(result)

        });

    } catch (error) {

        return sendError(

            res,

            error

        );

    }

}


/*
|--------------------------------------------------------------------------
| GET /api/ai/context
|--------------------------------------------------------------------------
*/

export async function context(req, res) {

    try {

        const conversationId =

            getConversationId(req);

        const visitorId =

            getVisitorId(req);

        const shopId =

            getShopId(req);

        const result =

            await buildAIContext({

                conversationId,

                visitorId,

                shopId

            });

        return res.json({

            success: true,

            context: result

        });

    } catch (error) {

        return sendError(

            res,

            error

        );

    }

}


/*
|--------------------------------------------------------------------------
| POST /api/ai/handoff
|--------------------------------------------------------------------------
*/

export async function requestHandoff(

    req,

    res

) {

    try {

        const conversationId =

            getConversationId(req);

        if (!conversationId) {

            return res.status(400).json({

                success: false,

                error:

                    "Conversation ID is required."

            });

        }

        const conversation =

            await Conversation.findById(

                conversationId

            );

        if (!conversation) {

            return res.status(404).json({

                success: false,

                error:

                    "Conversation not found."

            });

        }

        const updated =

            await ConversationService

                .requestHumanHandoff(

                    conversation

                );

        return res.json({

            success: true,

            message:

                "Human support requested.",

            conversation:

                updated

        });

    } catch (error) {

        return sendError(

            res,

            error

        );

    }

}


/*
|--------------------------------------------------------------------------
| POST /api/ai/handoff/accept
|--------------------------------------------------------------------------
*/

export async function acceptHandoff(

    req,

    res

) {

    try {

        const conversationId =

            getConversationId(req);

        const user =

            getRequestUser(req);

        if (!conversationId) {

            return res.status(400).json({

                success: false,

                error:

                    "Conversation ID is required."

            });

        }

        const conversation =

            await Conversation.findById(

                conversationId

            );

        if (!conversation) {

            return res.status(404).json({

                success: false,

                error:

                    "Conversation not found."

            });

        }

        const updated =

            await ConversationService

                .acceptHumanHandoff(

                    conversation,

                    user?._id || null

                );

        return res.json({

            success: true,

            conversation:

                updated

        });

    } catch (error) {

        return sendError(

            res,

            error

        );

    }

}


/*
|--------------------------------------------------------------------------
| POST /api/ai/handoff/close
|--------------------------------------------------------------------------
*/

export async function closeHandoff(

    req,

    res

) {

    try {

        const conversationId =

            getConversationId(req);

        if (!conversationId) {

            return res.status(400).json({

                success: false,

                error:

                    "Conversation ID is required."

            });

        }

        const conversation =

            await Conversation.findById(

                conversationId

            );

        if (!conversation) {

            return res.status(404).json({

                success: false,

                error:

                    "Conversation not found."

            });

        }

        const updated =

            await ConversationService

                .closeHumanHandoff(

                    conversation

                );

        return res.json({

            success: true,

            conversation:

                updated

        });

    } catch (error) {

        return sendError(

            res,

            error

        );

    }

}


/*
|--------------------------------------------------------------------------
| GET /api/ai/health
|--------------------------------------------------------------------------
*/

export async function health(req, res) {

    try {

        const result =

            await AIService.openai

                .healthCheck();

        return res.status(

            result.success

                ? 200

                : 503

        ).json(result);

    } catch (error) {

        return sendError(

            res,

            error,

            503

        );

    }

}


/*
|--------------------------------------------------------------------------
| Controller Export
|--------------------------------------------------------------------------
*/

export const AIController = {

    chat,

    detectIntent,

    recommendations,

    context,

    requestHandoff,

    acceptHandoff,

    closeHandoff,

    health

};


/*
|--------------------------------------------------------------------------
| Default Export
|--------------------------------------------------------------------------
*/

export default AIController;
