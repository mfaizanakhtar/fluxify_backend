"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetSkuByGroupSchema = exports.SkuNewDtoSchema = exports.RefundOrderSchema = exports.GetPackagesSchema = exports.PackageItemSchema = exports.EsimPackageDtoSchema = exports.CountryImageUrlDtoSchema = exports.NetworkDtoSchema = exports.GetSkusSchema = exports.SkuItemSchema = exports.AddEsimOrderSchema = exports.CanonicalEsimPayloadSchema = void 0;
exports.validateCanonical = validateCanonical;
exports.validateAddEsimOrder = validateAddEsimOrder;
exports.validateSkus = validateSkus;
exports.validatePackages = validatePackages;
exports.validateRefundOrder = validateRefundOrder;
exports.validateSkuByGroup = validateSkuByGroup;
const zod_1 = require("zod");
exports.CanonicalEsimPayloadSchema = zod_1.z.object({
    vendorId: zod_1.z.string().optional(),
    lpa: zod_1.z.string().optional(),
    activationCode: zod_1.z.string().optional(),
    iccid: zod_1.z.string().optional(),
});
function validateCanonical(payload) {
    return exports.CanonicalEsimPayloadSchema.parse(payload);
}
// Schema for the request payload sent to FiRoam's addEsimOrder endpoint.
exports.AddEsimOrderSchema = zod_1.z
    .object({
    // Required fields per FiRoam documentation
    skuId: zod_1.z.string(), // Product ID (country)
    priceId: zod_1.z.string().optional(), // Package price ID (optional for daypass with API code)
    count: zod_1.z.string(), // Order quantity
    // Conditional fields
    daypassDays: zod_1.z.string().optional(), // Required if supportDaypass=1
    beginDate: zod_1.z.string().optional(), // Required if mustDate=1, format: MM/dd/yyyy
    // Optional fields
    remark: zod_1.z.string().optional(),
    otherOrderId: zod_1.z.string().optional(),
    otherItemId: zod_1.z.string().optional(),
    otherPrice: zod_1.z.string().optional(),
    backInfo: zod_1.z.string().optional(),
    dpId: zod_1.z.string().optional(),
    iccids: zod_1.z.string().optional(),
    customerEmail: zod_1.z.string().optional(),
    isSendEmail: zod_1.z.string().optional(),
    pdfLanguage: zod_1.z.string().optional(),
})
    .passthrough(); // Allow additional vendor-specific fields
function validateAddEsimOrder(payload) {
    return exports.AddEsimOrderSchema.parse(payload);
}
// SKU schemas
exports.SkuItemSchema = zod_1.z.object({
    skuid: zod_1.z.coerce.number(),
    display: zod_1.z.string(),
    countryCode: zod_1.z.string(),
});
exports.GetSkusSchema = zod_1.z.array(exports.SkuItemSchema);
function validateSkus(payload) {
    return exports.GetSkusSchema.parse(payload);
}
// Package/Plan schemas
exports.NetworkDtoSchema = zod_1.z.object({
    type: zod_1.z.string(), // e.g., "LTE"
    operator: zod_1.z.string(),
    namecn: zod_1.z.string(),
    nameen: zod_1.z.string(),
});
exports.CountryImageUrlDtoSchema = zod_1.z.object({
    imageUrl: zod_1.z.string(),
    countryCode: zod_1.z.number(),
    name: zod_1.z.string(),
    nameEn: zod_1.z.string(),
});
exports.EsimPackageDtoSchema = zod_1.z.object({
    flows: zod_1.z.number(), // Traffic in package
    days: zod_1.z.number(), // Days of validity
    unit: zod_1.z.string(), // GB/MB
    price: zod_1.z.number(), // Package price
    priceid: zod_1.z.number(), // Unique identification (used for ordering)
    flowType: zod_1.z.number(), // 0-renewable, 1-non-renewable
    countryImageUrlDtoList: zod_1.z.array(exports.CountryImageUrlDtoSchema).nullable(),
    showName: zod_1.z.string(), // Display name
    pid: zod_1.z.number(),
    premark: zod_1.z.string(), // Description
    expireDays: zod_1.z.number(), // 0-effective immediately, non-zero-expires after n days
    networkDtoList: zod_1.z.array(exports.NetworkDtoSchema),
    supportDaypass: zod_1.z.number(), // 0-Regular, 1-Inclusive, 2-Enum package
    openCardFee: zod_1.z.number(),
    minDay: zod_1.z.number(),
    singleDiscountDay: zod_1.z.number(),
    singleDiscount: zod_1.z.number(),
    maxDiscount: zod_1.z.number(),
    maxDay: zod_1.z.number(),
    mustDate: zod_1.z.number(), // 1-Required
    apiCode: zod_1.z.string(), // Unique identifier for the package
});
exports.PackageItemSchema = zod_1.z.object({
    skuid: zod_1.z.number(),
    detailId: zod_1.z.number().nullable(),
    countrycode: zod_1.z.string(),
    imageUrl: zod_1.z.string(),
    display: zod_1.z.string(),
    displayEn: zod_1.z.string(),
    esimPackageDtoList: zod_1.z.array(exports.EsimPackageDtoSchema),
    supportCountry: zod_1.z.array(zod_1.z.string()),
    expirydate: zod_1.z.string().nullable(),
    countryImageUrlDtoList: zod_1.z.array(exports.CountryImageUrlDtoSchema),
});
exports.GetPackagesSchema = exports.PackageItemSchema;
function validatePackages(payload) {
    return exports.GetPackagesSchema.parse(payload);
}
// Refund/Cancel Order response schema
exports.RefundOrderSchema = zod_1.z.object({
    code: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]),
    message: zod_1.z.string(),
    data: zod_1.z.null().or(zod_1.z.string()),
});
function validateRefundOrder(payload) {
    return exports.RefundOrderSchema.parse(payload);
}
// SKU grouped by continent schemas
exports.SkuNewDtoSchema = zod_1.z.object({
    skuid: zod_1.z.number(),
    countryCode: zod_1.z.number(),
    imageUrl: zod_1.z.string(),
    display: zod_1.z.string(),
    note: zod_1.z.string(),
    search: zod_1.z.string(),
    continentCode: zod_1.z.number(),
});
exports.GetSkuByGroupSchema = zod_1.z.object({
    continent: zod_1.z.array(zod_1.z.string()),
    data: zod_1.z.record(zod_1.z.string(), zod_1.z.array(exports.SkuNewDtoSchema)),
});
function validateSkuByGroup(payload) {
    return exports.GetSkuByGroupSchema.parse(payload);
}
