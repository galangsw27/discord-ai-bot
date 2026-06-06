# Phase 1: Roblox Avatar Marketplace — Core Catalog + Try-On

## Overview
Rebuild catalog UI from scratch as a slide-out side panel. Full avatar preview with live try-on via `HumanoidDescription:ApplyDescription`. Fetch catalog items via `AvatarEditorService:SearchCatalog`.

## UI Layout

### Slide-Out Panel (Right Side)
- **Width:** 420px
- **Height:** Full screen (Fill)
- **Entry trigger:** Toggle button anchored to right edge (looks like a hang tag / shop icon)
- **Animation:** Slides in/out from right, 0.4s easing
- **Backdrop:** Semi-transparent overlay behind panel, click to close

### Panel Structure (top to bottom)
1. **Header bar** — close button, "CATALOG" title, search icon
2. **Search bar** — keyword TextBox, full width, debounced 500ms
3. **Filter strip** — horizontal scrollable row of filter chips (category, asset type, sort, sales type)
4. **Item grid** — ScrollingFrame with UICardLayout, 2 columns
5. **Pagination** — "Load More" button at bottom (no infinite scroll for throttling control)

### Item Card (each grid item)
- **Thumbnail:** 180x180 ImageLabel with rbxthumb://
- **Name:** TextLabel, 1 line truncated
- **Price:** TextLabel with R$ icon
- **Item type badge:** small label (Hat, Hair, Bundle, etc.)
- **Click:** triggers try-on on live character AND shows 3D preview

### 3D Preview (left side of screen, always visible)
- **ViewportFrame** — 300x400px, anchored bottom-left
- **Camera** — orbits around avatar, auto-rotates slowly
- **Shows:** player's current live character appearance
- **Updates:** every time try-on fires
- **Overlay:** item name + price of selected item below viewport

## Architecture

### Client Scripts
- `CatalogClient` (LocalScript) — UI builder, catalog fetch, try-on logic
- `CatalogUIService` (ModuleScript) — manages panel open/close state, selected item

### Server Scripts
- `CatalogEquipServer` (Script) — validates and applies accessories to live character
- `CatalogDataService` (ModuleScript) — outfit save/load (Phase 3)

### RemoteEvents / RemoteFunctions
- `CatalogEquipEvent` (RemoteEvent) — try-on request: `(assetId, assetType, accessoryType)`
- `CatalogSaveOutfitEvent` (RemoteEvent) — Phase 3
- `CatalogLoadOutfitEvent` (RemoteFunction) — Phase 3

## Try-On Pipeline

1. Client fires `CatalogEquipEvent(assetId, assetType, accessoryType)`
2. Server validates:
   - `InsertService:LoadAsset(assetId)` → get accessory
   - Get accessory type from Accessory.AccessoryType
3. Server calls `AvatarEditorService:GetAccessoryType(Enum.AvatarAssetType.X)` to map if needed
4. Server loads player's `HumanoidDescription` via `Humanoid:GetAppliedDescription()`
5. Server calls `desc:GetAccessories(true)` to get full accessory list including rigid
6. Server adds new accessory entry with `AssetId`, `AccessoryType`, `Order`, `IsLayered`
7. Server calls `desc:SetAccessories(accessories, true)`
8. Server calls `Humanoid:ApplyDescription(desc)`
9. Server destroys temp accessory model

## Catalog Fetch (Client)
- `AvatarEditorService:SearchCatalog(CatalogSearchParams)` returns `CatalogPages`
- `pages:GetCurrentPage()` → array of item rows
- `mapCatalogPage(items)` normalizes each row:
  - `id` = `item.Id` or `item.AssetId`
  - `productId` = `item.ProductId`
  - `itemType` = normalized `item.ItemType.Name`
  - `assetType` = `item.AssetType.Value` (EnumItem → number)
  - `thumbnail` = rbxthumb:// with correct type (Asset vs BundleThumbnail)
  - `previewable` = `itemType == "Asset"` + assetType in WEARABLE_ASSET_TYPES
  - `wearable` = same as previewable

## Filter Support (AvatarEditorService compatible)
- Category: Featured, Recommended, Premium, Collectibles, CommunityCreations, All/None
- SalesType: All, Collectibles, Premium, TimedOptions
- SortType: Relevance (only Roblox-supported option at runtime)
- AssetTypes: array of AvatarAssetType enum items
- SearchKeyword: string
- Limit: 10, 28, 30, 60, 120

## 3D Preview (ViewportFrame)
- On item click: fetch player's `HumanoidDescription`
- Call `SetAccessories` with current accessories + new item
- Call `CreateHumanoidModelFromDescriptionAsync` → preview rig
- Parent preview rig into ViewportFrame's WorldModel
- Set ViewportFrame.CurrentCamera to orbit around rig
- Destroy old preview rig before building new one

## Error Handling
- **Search failed:** Show "Catalog unavailable" message in grid area
- **Empty results:** Show "No items found" with suggestion to change filters
- **LoadAsset failed:** Show "Item unavailable" toast, disable wear
- **ApplyDescription failed:** Show error toast, keep previous state
- **Throttled:** Show "Please wait" + retry with backoff

## Performance
- Debounce filter changes: 500ms
- Debounce search: 500ms
- Cache catalog results per filter snapshot
- Limit displayed cards to 60, show "Load More"
- Clear old preview rig before building new
- Use `task.defer` for non-blocking UI updates

## Component Files
| File | Type | Purpose |
|------|------|---------|
| `StarterGui.CatalogPanel` | ScreenGui | Slide-out catalog panel |
| `StarterGui.CatalogPanel.PreviewViewport` | ViewportFrame | 3D avatar preview |
| `StarterPlayerScripts.CatalogClient` | LocalScript | UI builder, fetch, try-on |
| `ServerScriptService.CatalogEquipServer` | Script | Server-side equip logic |
| `ReplicatedStorage.CatalogEquipEvent` | RemoteEvent | Client→server try-on |
| `ReplicatedStorage.CatalogEvents` | RemoteFunction | Server→client preview asset |

## Outfit Save/Load (Phase 3 prep)
- Store in server DataStore: `{ outfitName, accessories: [{assetId, accessoryType}] }`
- Outfit code: 6-character alphanumeric hash
- Max 10 outfits per player