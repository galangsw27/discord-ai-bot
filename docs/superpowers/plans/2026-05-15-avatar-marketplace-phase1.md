# Avatar Marketplace Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a slide-out catalog panel with item browsing, 3D preview, and real-time avatar try-on via HumanoidDescription.

**Architecture:** Client fetches catalog via `AvatarEditorService:SearchCatalog`, builds UI in a slide-out panel. Try-on fires RemoteEvent to server, which loads accessory, updates HumanoidDescription with new accessory entry, and applies it to live character. Preview builds a separate HumanoidDescription + CreateHumanoidModelFromDescriptionAsync rig in ViewportFrame.

**Tech Stack:** Roblox Lua, AvatarEditorService, HumanoidDescription, InsertService, ViewportFrame, CatalogSearchParams, ModuleScript architecture

---

## File Structure

| File | Type | Responsibility |
|------|------|--------------|
| `StarterGui.CatalogPanel` | ScreenGui | Slide-out catalog panel + preview viewport |
| `StarterPlayerScripts.CatalogClient` | LocalScript | Catalog fetch, UI builder, event wiring |
| `ReplicatedStorage.CatalogConfig` | ModuleScript | Shared constants: enum maps, asset type whitelist, filter definitions |
| `ReplicatedStorage.CatalogItemsUtil` | ModuleScript | Catalog row normalization, thumbnail URL builder, price formatter |
| `ServerScriptService.CatalogEquipServer` | Script | Try-on logic: LoadAsset → HumanoidDescription update → ApplyDescription |
| `ServerScriptService.PreviewAssetServer` | Script | Server-side asset loading for preview (returns accessory clone) |
| `ReplicatedStorage.CatalogEquipEvent` | RemoteEvent | Client→server try-on signal (payload: assetId, assetType) |
| `ReplicatedStorage.PreviewAssetEvent` | RemoteFunction | Client→server asset load for preview |

---

## Task 1: Shared Config Module

**Files:**
- Create: `ReplicatedStorage.CatalogConfig`

- [ ] **Step 1: Create CatalogConfig ModuleScript**

```lua
local CatalogConfig = {}

CatalogConfig.CATEGORY_MAP = {
    Featured = Enum.CatalogCategoryFilter.Featured,
    Recommended = Enum.CatalogCategoryFilter.Recommended,
    Premium = Enum.CatalogCategoryFilter.Premium,
    Collectibles = Enum.CatalogCategoryFilter.Collectibles,
    CommunityCreations = Enum.CatalogCategoryFilter.CommunityCreations,
    All = Enum.CatalogCategoryFilter.None,
}

CatalogConfig.SALES_MAP = {
    All = Enum.SalesTypeFilter.All,
    Collectibles = Enum.SalesTypeFilter.Collectibles,
    Premium = Enum.SalesTypeFilter.Premium,
    TimedOptions = Enum.SalesTypeFilter.TimedOptions,
}

CatalogConfig.SORT_MAP = {
    Relevance = Enum.CatalogSortType.Relevance,
}

CatalogConfig.FILTER_CATEGORIES = {
    { label = "Featured", value = "Featured" },
    { label = "Recommended", value = "Recommended" },
    { label = "Premium", value = "Premium" },
    { label = "Collectibles", value = "Collectibles" },
    { label = "Community", value = "CommunityCreations" },
    { label = "All", value = "All" },
}

CatalogConfig.FILTER_SALES = {
    { label = "All", value = "All" },
    { label = "Collectibles", value = "Collectibles" },
    { label = "Premium", value = "Premium" },
    { label = "Timed", value = "TimedOptions" },
}

CatalogConfig.FILTER_ASSETS = {
    { label = "Hat", value = Enum.AvatarAssetType.Hat },
    { label = "Hair", value = Enum.AvatarAssetType.HairAccessory },
    { label = "Face", value = Enum.AvatarAssetType.FaceAccessory },
    { label = "Neck", value = Enum.AvatarAssetType.NeckAccessory },
    { label = "Shoulder", value = Enum.AvatarAssetType.ShoulderAccessory },
    { label = "Front", value = Enum.AvatarAssetType.FrontAccessory },
    { label = "Back", value = Enum.AvatarAssetType.BackAccessory },
    { label = "Waist", value = Enum.AvatarAssetType.WaistAccessory },
    { label = "T-Shirt", value = Enum.AvatarAssetType.TShirtAccessory },
    { label = "Shirt", value = Enum.AvatarAssetType.ShirtAccessory },
    { label = "Pants", value = Enum.AvatarAssetType.PantsAccessory },
    { label = "Jacket", value = Enum.AvatarAssetType.JacketAccessory },
    { label = "Shorts", value = Enum.AvatarAssetType.ShortsAccessory },
    { label = "Shoes", value = Enum.AvatarAssetType.LeftShoeAccessory },
}

CatalogConfig.WEARABLE_ASSET_TYPES = {
    [2] = true, [8] = true, [11] = true, [12] = true,
    [17] = true, [18] = true, [27] = true, [28] = true,
    [29] = true, [30] = true, [31] = true, [41] = true,
    [42] = true, [43] = true, [44] = true, [45] = true,
    [46] = true, [47] = true, [64] = true, [65] = true,
    [66] = true, [67] = true, [68] = true, [69] = true,
    [70] = true, [71] = true, [72] = true, [76] = true,
    [77] = true, [79] = true, [88] = true, [89] = true,
    [90] = true,
}

CatalogConfig.ACCESSORY_TYPE_TO_ENUM = {
    [8] = Enum.AccessoryType.Hat,
    [41] = Enum.AccessoryType.Hair,
    [42] = Enum.AccessoryType.Face,
    [43] = Enum.AccessoryType.Neck,
    [44] = Enum.AccessoryType.Shoulder,
    [45] = Enum.AccessoryType.Front,
    [46] = Enum.AccessoryType.Back,
    [47] = Enum.AccessoryType.Waist,
    [64] = Enum.AccessoryType.TShirt,
    [65] = Enum.AccessoryType.Shirt,
    [66] = Enum.AccessoryType.Pants,
    [67] = Enum.AccessoryType.Jacket,
    [68] = Enum.AccessoryType.Sweater,
    [69] = Enum.AccessoryType.Shorts,
    [70] = Enum.AccessoryType.LeftShoe,
    [71] = Enum.AccessoryType.RightShoe,
    [72] = Enum.AccessoryType.DressSkirt,
    [76] = Enum.AccessoryType.Eyebrow,
    [77] = Enum.AccessoryType.Eyelash,
    [88] = Enum.AccessoryType.Face,
    [89] = Enum.AccessoryType.Face,
    [90] = Enum.AccessoryType.Face,
}

CatalogConfig.ASSET_TYPE_TO_ACCESSORY_ENUM = {}
for assetTypeVal, accEnum in pairs(CatalogConfig.ACCESSORY_TYPE_TO_ENUM) do
    CatalogConfig.ASSET_TYPE_TO_ACCESSORY_ENUM[assetTypeVal] = accEnum.Value
end

return CatalogConfig
```

- [ ] **Step 2: Verify in Studio by printing from execute_luau**

Run in Studio:
```lua
local CatalogConfig = require(game.ReplicatedStorage.CatalogConfig)
print("ACCESSORY_TYPE_TO_ENUM keys:", #CatalogConfig.ACCESSORY_TYPE_TO_ENUM)
print("WEARABLE count:", #CatalogConfig.WEARABLE_ASSET_TYPES)
```
Expected: prints key counts, no errors.

---

## Task 2: Catalog Items Utility Module

**Files:**
- Create: `ReplicatedStorage.CatalogItemsUtil`

- [ ] **Step 1: Create utility module**

```lua
local CatalogItemsUtil = {}

local AvatarEditorService = game:GetService("AvatarEditorService")

function CatalogItemsUtil.formatPrice(price)
    if type(price) == "number" and price > 0 then
        return tostring(price) .. " R$"
    end
    return "Free"
end

function CatalogItemsUtil.buildThumb(id, itemType)
    if tostring(itemType) == "Bundle" then
        return "rbxthumb://type=BundleThumbnail&id=" .. tostring(id) .. "&w=420&h=420"
    end
    return "rbxthumb://type=Asset&id=" .. tostring(id) .. "&w=420&h=420"
end

function CatalogItemsUtil.normalizeItemType(itemTypeRaw)
    if typeof(itemTypeRaw) == "EnumItem" then
        return itemTypeRaw.Name
    end
    local asString = tostring(itemTypeRaw or "Asset")
    if string.find(asString, "Bundle") then
        return "Bundle"
    end
    return "Asset"
end

function CatalogItemsUtil.resolveAssetType(item)
    local assetTypeRaw = item.AssetType
    if type(assetTypeRaw) == "number" then
        return assetTypeRaw
    end
    if typeof(assetTypeRaw) == "EnumItem" then
        return assetTypeRaw.Value
    end
    local assetTypeName = item.AssetTypeName or item.AssetType
    if type(assetTypeName) == "string" then
        for _, enumItem in ipairs(Enum.AvatarAssetType:GetEnumItems()) do
            if enumItem.Name == assetTypeName then
                return enumItem.Value
            end
        end
    end
    return 0
end

function CatalogItemsUtil.getAccessoryTypeValue(assetType)
    for _, enumItem in ipairs(Enum.AvatarAssetType:GetEnumItems()) do
        if enumItem.Value == assetType then
            local accEnum = AvatarEditorService:GetAccessoryType(enumItem)
            if accEnum then
                return accEnum.Value
            end
        end
    end
    return 0
end

function CatalogItemsUtil.mapCatalogPage(page, wearableMap)
    local mapped = {}
    for _, item in ipairs(page) do
        local itemType = CatalogItemsUtil.normalizeItemType(item.ItemType)
        local catalogId = item.Id or item.AssetId
        local productId = item.ProductId or catalogId
        local assetId = item.AssetId or catalogId
        local actionId = itemType == "Bundle" and productId or assetId
        local assetType = CatalogItemsUtil.resolveAssetType(item)
        local isWearable = itemType == "Asset" and wearableMap[assetType] == true

        if catalogId then
            table.insert(mapped, {
                id = tostring(catalogId),
                actionId = tostring(actionId),
                productId = tostring(productId),
                itemType = itemType,
                name = item.Name or "Unknown",
                price = CatalogItemsUtil.formatPrice(item.Price),
                thumbnail = CatalogItemsUtil.buildThumb(catalogId, itemType),
                assetType = assetType,
                previewable = isWearable,
                wearable = isWearable,
            })
        end
    end
    return mapped
end

return CatalogItemsUtil
```

- [ ] **Step 2: Test normalization with sample data**

Run in Studio:
```lua
local util = require(game.ReplicatedStorage.CatalogItemsUtil)
print("resolveAssetType WaistAccessory:", util.resolveAssetType({AssetType = Enum.AvatarAssetType.WaistAccessory}))
print("getAccessoryType 47:", util.getAccessoryTypeValue(47))
```
Expected: `47` and `8` (WaistAccessory maps to AccessoryType.Waist = 8).

---

## Task 3: Server-Side Try-On (CatalogEquipServer)

**Files:**
- Create: `ServerScriptService.CatalogEquipServer`
- Modify: existing equips if present

- [ ] **Step 1: Write server script**

```lua
local InsertService = game:GetService("InsertService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local equipEvent = ReplicatedStorage:WaitForChild("CatalogEquipEvent")
local CatalogConfig = require(ReplicatedStorage:WaitForChild("CatalogConfig"))

local ACCESSORY_MAP = CatalogConfig.ACCESSORY_TYPE_TO_ENUM

local function clearAccessoryType(character, accessoryType)
    for _, child in ipairs(character:GetChildren()) do
        if child:IsA("Accessory") and child.AccessoryType == accessoryType then
            child:Destroy()
        end
    end
end

local function equipViaHumanoidDescription(player, itemId, assetType)
    local character = player.Character
    if not character then return false, "no_character" end
    local humanoid = character:FindFirstChildWhichIsA("Humanoid")
    if not humanoid then return false, "no_humanoid" end

    local accessoryType = ACCESSORY_MAP[tonumber(assetType)]
    if not accessoryType then return false, "unsupported_asset_type" end

    local descOk, desc = pcall(function()
        return humanoid:GetAppliedDescription()
    end)
    if not descOk or not desc then return false, "no_description" end

    local accOk, accessories = pcall(function()
        return desc:GetAccessories(true)
    end)
    if not accOk or type(accessories) ~= "table" then
        accessories = {}
    end

    for i, acc in ipairs(accessories) do
        if acc.AccessoryType == accessoryType.Value then
            table.remove(accessories, i)
            break
        end
    end

    table.insert(accessories, {
        AssetId = tonumber(itemId),
        IsLayered = false,
        Order = #accessories + 1,
        Puffiness = 0,
        AccessoryType = accessoryType.Value,
    })

    local setOk, setErr = pcall(function()
        desc:SetAccessories(accessories, true)
        humanoid:ApplyDescription(desc)
    end)
    if not setOk then
        return false, "apply_failed: " .. tostring(setErr)
    end

    return true, nil
end

equipEvent.OnServerEvent:Connect(function(player, actionId, itemName, assetType, itemType, productId)
    if type(actionId) ~= "string" and type(actionId) ~= "number" then return end
    if itemType == "Bundle" then
        warn("Bundles not yet supported")
        return
    end
    if not ACCESSORY_MAP[tonumber(assetType)] then
        warn("Unsupported asset type for equip:", assetType)
        return
    end
    local success, err = equipViaHumanoidDescription(player, actionId, assetType)
    if not success then
        warn("Equip failed:", err)
    end
end)
```

- [ ] **Step 2: Play test — fire event, verify character updates**

---

## Task 4: Preview Asset Server

**Files:**
- Create: `ServerScriptService.PreviewAssetServer`

- [ ] **Step 1: Write preview asset loader**

```lua
local InsertService = game:GetService("InsertService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local previewEvent = ReplicatedStorage:WaitForChild("PreviewAssetEvent")

previewEvent.OnServerInvoke = function(player, assetId)
    if type(assetId) ~= "number" then return nil end
    local ok, assetModel = pcall(function()
        return InsertService:LoadAsset(assetId)
    end)
    if not ok or not assetModel then return nil end

    local accessory = assetModel:FindFirstChildWhichIsA("Accessory", true)
    if not accessory then
        assetModel:Destroy()
        return nil
    end

    accessory.Parent = ReplicatedStorage
    assetModel:Destroy()
    return accessory
end
```

- [ ] **Step 2: Test from Studio console**

---

## Task 5: Catalog UI — Slide-Out Panel

**Files:**
- Create: `StarterGui.CatalogPanel` ScreenGui
- Create: `StarterPlayerScripts.CatalogClient` LocalScript

- [ ] **Step 1: Create ScreenGui structure**

Create `StarterGui.CatalogPanel` with:
- `BackdropFrame` (Frame, full screen, semi-transparent black)
- `PanelFrame` (Frame, size UDim2.new(0, 420, 1, 0), position UDim2.new(1, 0, 0, 0))
  - `Header` (Frame, 0, 50)
    - `CloseButton` (TextButton, "X")
    - `Title` (TextLabel, "CATALOG")
    - `SearchButton` (ImageButton or TextButton)
  - `SearchBar` (TextBox, hidden by default)
  - `FilterScroll` (ScrollingFrame, 0, 40, horizontal)
  - `ItemGrid` (ScrollingFrame, fill remaining)
    - `UIGridLayout` (2 columns, cell padding 8, cell size 0.5, 0, -12 / 0, 180)
    - `TemplateCard` (Frame, visible=false)
      - `Thumbnail` (ImageLabel)
      - `NameLabel` (TextLabel)
      - `PriceLabel` (TextLabel)
      - `TypeBadge` (TextLabel)
- `PreviewViewport` (ViewportFrame, position UDim2.new(0, 20, 0.6, 0), size UDim2.new(0, 300, 0, 400))

- [ ] **Step 2: Write CatalogClient UI builder**

```lua
local Players = game:GetService("Players")
local AvatarEditorService = game:GetService("AvatarEditorService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer
local CatalogConfig = require(ReplicatedStorage:WaitForChild("CatalogConfig"))
local CatalogItemsUtil = require(ReplicatedStorage:WaitForChild("CatalogItemsUtil"))

local equipEvent = ReplicatedStorage:WaitForChild("CatalogEquipEvent")
local previewEvent = ReplicatedStorage:WaitForChild("PreviewAssetEvent")

local ui = player:WaitForChild("PlayerGui"):WaitForChild("CatalogPanel")
local backdrop = ui:WaitForChild("BackdropFrame")
local panel = ui:WaitForChild("PanelFrame")
local grid = panel:WaitForChild("ItemGrid")
local filterScroll = panel:WaitForChild("FilterScroll")
local templateCard = grid:WaitForChild("TemplateCard")
local previewViewport = ui:WaitForChild("PreviewViewport")

local isOpen = false
local previewRig = nil
local previewConn = nil
local currentItems = {}
local currentFilter = { category="Featured", salesType="All", sortType="Relevance", keyword="", assetTypes={}, limit=30 }

local function openPanel()
    isOpen = true
    ui.Enabled = true
    TweenService:Create(panel, TweenInfo.new(0.4, Enum.EasingStyle.Quart, Enum.EasingDirection.Out), {Position = UDim2.new(1, -420, 0, 0)}):Play()
    TweenService:Create(backdrop, TweenInfo.new(0.3), {BackgroundTransparency = 0.5}):Play()
end

local function closePanel()
    isOpen = false
    TweenService:Create(panel, TweenInfo.new(0.4, Enum.EasingStyle.Quart, Enum.EasingDirection.Out), {Position = UDim2.new(1, 0, 0, 0)}):Play()
    TweenService:Create(backdrop, TweenInfo.new(0.3), {BackgroundTransparency = 1}):Play()
    task.delay(0.4, function()
        if not isOpen then ui.Enabled = false end
    end)
end

local function buildFilterChips()
    filterScroll:ClearAllChildren()
    local layout = Instance.new("UIListLayout")
    layout.FillDirection = Enum.FillDirection.Horizontal
    layout.Padding = UDim.new(0, 6)
    layout.Parent = filterScroll

    for _, def in ipairs(CatalogConfig.FILTER_CATEGORIES) do
        local chip = Instance.new("TextButton")
        chip.Size = UDim2.new(0, 0, 1, 0)
        chip.AutomaticSize = Enum.AutomaticSize.X
        chip.Text = def.label
        chip.Parent = filterScroll
        -- styling omitted for brevity
    end
end

local function clearGrid()
    for _, child in ipairs(grid:GetChildren()) do
        if child:IsA("Frame") and child ~= templateCard then child:Destroy() end
    end
end

local function buildCard(item)
    local card = templateCard:Clone()
    card.Visible = true
    card.Name = "Card_" .. item.id
    card:WaitForChild("Thumbnail").Image = item.thumbnail
    card:WaitForChild("NameLabel").Text = item.name
    card:WaitForChild("PriceLabel").Text = item.price
    card:WaitForChild("TypeBadge").Text = item.itemType
    card.Parent = grid
    card.InputBegan:Connect(function(input)
        if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
            if item.wearable then
                equipEvent:FireServer(item.actionId, item.name, item.assetType, item.itemType, item.productId)
            end
            previewItem(item)
        end
    end)
end

local function fetchAndRender()
    clearGrid()
    local params = CatalogSearchParams.new()
    params.CategoryFilter = CatalogConfig.CATEGORY_MAP[currentFilter.category]
    params.SalesTypeFilter = CatalogConfig.SALES_MAP[currentFilter.salesType]
    params.SortType = CatalogConfig.SORT_MAP[currentFilter.sortType]
    params.Limit = currentFilter.limit
    if currentFilter.keyword ~= "" then params.SearchKeyword = currentFilter.keyword end
    if #currentFilter.assetTypes > 0 then params.AssetTypes = currentFilter.assetTypes end

    local ok, pages = pcall(function() return AvatarEditorService:SearchCatalog(params) end)
    if not ok then warn("Search failed:", pages) return end
    local ok2, page = pcall(function() return pages:GetCurrentPage() end)
    if not ok2 then warn("Page fetch failed:", page) return end

    currentItems = CatalogItemsUtil.mapCatalogPage(page, CatalogConfig.WEARABLE_ASSET_TYPES)
    for _, item in ipairs(currentItems) do
        buildCard(item)
    end
end

local function previewItem(item)
    -- clear old preview
    if previewRig then previewRig:Destroy() end
    if previewConn then previewConn:Disconnect() end

    local player = Players.LocalPlayer
    local okDesc, baseDesc = pcall(function()
        return Players:GetHumanoidDescriptionFromUserIdAsync(player.UserId)
    end)
    if not okDesc then return end

    local accTypeVal = CatalogItemsUtil.getAccessoryTypeValue(item.assetType)
    local accOk, accessories = pcall(function() return baseDesc:GetAccessories(true) end)
    if not accOk or type(accessories) ~= "table" then accessories = {} end

    table.insert(accessories, {
        AssetId = tonumber(item.actionId),
        AccessoryType = accTypeVal,
        IsLayered = false,
        Order = #accessories + 1,
        Puffiness = 0,
    })

    pcall(function() baseDesc:SetAccessories(accessories, true) end)

    local okRig, rig = pcall(function()
        return Players:CreateHumanoidModelFromDescriptionAsync(baseDesc, Enum.HumanoidRigType.R15)
    end)
    if not okRig or not rig then return end

    previewRig = rig
    previewRig.Parent = previewViewport

    local cam = Instance.new("Camera")
    cam.Parent = previewViewport
    previewViewport.CurrentCamera = cam

    local root = previewRig:FindFirstChild("HumanoidRootPart")
    if root then
        local center = root.Position
        local angle = 0
        previewConn = game:GetService("RunService").RenderStepped:Connect(function(dt)
            if not previewRig or not previewRig.Parent then previewConn:Disconnect() return end
            angle = angle + dt * 0.6
            local r = 6
            local x = center.X + math.cos(angle) * r
            local z = center.Z + math.sin(angle) * r
            cam.CFrame = CFrame.new(Vector3.new(x, center.Y + 2, z), center + Vector3.new(0, 1.5, 0))
        end)
    end
end

-- Toggle button wiring
ui:WaitForChild("ToggleButton").MouseButton1Click:Connect(openPanel)
backdrop.InputBegan:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1 then closePanel() end
end)

buildFilterChips()
fetchAndRender()
```

- [ ] **Step 3: Play test — verify slide-out panel, item grid, click-to-wear, preview**