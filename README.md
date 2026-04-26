# Neo Bot

Neo Bot is a Facebook Messenger bot framework built around a plugin-based command/event system, FcaPrime connectivity, private WebSocket API support, SQLite-backed data storage, and media utilities powered by Khotools API.

Neo Bot là bot Facebook Messenger được thiết kế theo kiến trúc plugin command/event, hỗ trợ FcaPrime, Private WebSocket API, lưu trữ dữ liệu bằng SQLite và các tiện ích media thông qua Khotools API.

Created by **Hoàng Đình Quyết (HoangDev)**.

## English

### Features

- Facebook Messenger bot with command and event plugin architecture.
- FcaPrime support with MQTT reconnect, optional E2EE configuration, and remote API bridge.
- SQLite-based bot data for features such as message statistics, rent data, AFK, shortcuts, and group settings.
- Utility commands: menu, ping, uptime, AFK, shortcuts, kick, anti settings, message statistics, music, media download/upload, NASA Landsat name images, and more.
- Khotools API integration for private WebSocket, downloader, media conversion, and Facebook-related API services.

### Requirements

- Node.js 20 or newer is recommended.
- npm.
- A Facebook account/session cookie for the bot.
- A Khotools API key.

### Get A Khotools API Key

1. Open [https://khotools.com](https://khotools.com).
2. Register a new account or log in to your existing account.
3. Go to the **API-Key** tab.
4. Create a new API key.
5. Copy the generated key.
6. Paste it into `bot/config.json` under `api.key`.

### Installation

```bash
git clone <your-repository-url>
cd newapi
npm install
```

### Configuration

Edit `bot/config.json` before running the bot:

```json
{
  "PREFIX": "!",
  "BOTNAME": "Neo Bot",
  "api": {
    "url": "https://api.khotools.com",
    "key": "YOUR_KHOTOOLS_API_KEY",
    "fca": "fcaPrime"
  },
  "ADMINBOT": ["YOUR_FACEBOOK_UID"],
  "cookie": "c_user=...; xs=...;"
}
```

You can also store the Facebook cookie in `bot/cookie.txt` depending on your deployment flow.

FCA runtime options are stored in `bot/configFca.json`, including MQTT reconnect and E2EE settings.

### Running

```bash
npm start
```

Development mode:

```bash
npm run dev
```

### Common Commands

| Command | Purpose |
| --- | --- |
| `menu` | Show available bot commands. |
| `ping` | Check bot latency. |
| `upt` | Show uptime and runtime status. |
| `afk` | Mark yourself as AFK with an optional reason. |
| `shortcut` | Create automatic text/media replies. |
| `kick` | Remove a member from a group, admin only. |
| `autodown` | Auto-download supported links. |
| `sing`, `singfb` | Search and send music/audio. |
| `rupload` | Upload media through Facebook upload flow. |
| `name` | Generate NASA Landsat letter images from text. |
| `anti` | Manage group protection settings. |
| `noti` | Configure group notifications and top activity reports. |

Command availability may depend on your configuration, permissions, and API key.

### Project Structure

```text
bot/
  config.json              Main bot configuration
  configFca.json           FCA/FcaPrime runtime configuration
  cookie.txt               Optional Facebook cookie file
  plugins/
    commands/              Command plugins
    events/                Event plugins
  main/
    handle/                Message/event handlers
    utils/                 Database and runtime utilities

lib/
  FcaPrime/                Facebook client implementation

public/                    Public media/cache assets
```

### Command Plugin Example

```js
module.exports = {
  config: {
    name: "hello",
    aliases: [],
    role: 0,
    info: "Send a hello message",
    Category: "Utility",
    hasPrefix: true
  },

  onRun: async ({ api, event, args, database }) => {
    return api.sendMessage("Hello!", event.threadID, event.messageID);
  },

  onEvent: async ({ api, event, database }) => {
    // Optional event handler.
  }
};
```

### Security Notes

Do not commit real secrets to Git:

- `bot/config.json` with a real API key.
- Facebook cookies.
- Access tokens.
- Facebook account credentials.
- `.env` files.
- Runtime databases or private cache files.

Use private deployment configuration or environment-specific files for production.

### Disclaimer

This project is intended for personal automation, learning, and private deployment. Use it responsibly and follow the rules of the services you connect to. This project is not affiliated with Meta or Facebook.

## Tiếng Việt

### Giới Thiệu

Neo Bot là bot Facebook Messenger do **Hoàng Đình Quyết (HoangDev)** phát triển, hướng đến khả năng mở rộng bằng plugin, xử lý lệnh/event riêng biệt, lưu dữ liệu bằng SQLite và kết nối API từ Khotools.

Bot phù hợp cho việc quản lý nhóm, tự động hóa tin nhắn, thống kê tương tác, xử lý media, tạo shortcut, chơi game Ma Sói và các tiện ích Messenger khác.

### Tính Năng

- Hệ thống lệnh và event tách riêng, dễ thêm module mới.
- Hỗ trợ FcaPrime, MQTT reconnect, cấu hình E2EE và Private WebSocket API.
- Lưu dữ liệu bằng SQLite cho thống kê tin nhắn, rent, AFK, shortcut và setting nhóm.
- Các lệnh tiện ích: menu, ping, uptime, AFK, shortcut, kick, anti, thống kê tương tác, nhạc, download/upload media, tạo ảnh NASA Landsat theo tên.
- Tích hợp Khotools API cho downloader, media convert, Facebook API và Private WS.

### Yêu Cầu

- Node.js 20 trở lên.
- npm.
- Cookie/session Facebook của tài khoản bot.
- API key từ Khotools.

### Cách Lấy API Key Khotools

1. Truy cập [https://khotools.com](https://khotools.com).
2. Đăng ký tài khoản mới hoặc đăng nhập tài khoản hiện có.
3. Chuyển sang tab **API-Key**.
4. Tạo key mới.
5. Copy API key vừa tạo.
6. Dán key vào file `bot/config.json` tại mục `api.key`.

### Cài Đặt

```bash
git clone <your-repository-url>
cd newapi
npm install
```

### Cấu Hình

Mở file `bot/config.json` và sửa các giá trị cần thiết:

```json
{
  "PREFIX": "!",
  "BOTNAME": "Neo Bot",
  "api": {
    "url": "https://api.khotools.com",
    "key": "YOUR_KHOTOOLS_API_KEY",
    "fca": "fcaPrime"
  },
  "ADMINBOT": ["YOUR_FACEBOOK_UID"],
  "cookie": "c_user=...; xs=...;"
}
```

Nếu muốn tách cookie riêng, có thể đặt cookie vào `bot/cookie.txt` tùy theo cách triển khai.

File `bot/configFca.json` dùng để cấu hình FCA/FcaPrime như MQTT reconnect, E2EE và các tùy chọn đồng bộ.

### Chạy Bot

```bash
npm start
```

Chế độ dev:

```bash
npm run dev
```

### Một Số Lệnh Có Sẵn

| Lệnh | Chức năng |
| --- | --- |
| `menu` | Xem danh sách lệnh. |
| `ping` | Kiểm tra độ trễ bot. |
| `upt` | Xem thời gian hoạt động và trạng thái runtime. |
| `afk` | Đặt trạng thái vắng mặt kèm lý do tùy chọn. |
| `shortcut` | Tạo phản hồi tự động bằng text/media. |
| `kick` | Kick thành viên khỏi nhóm, chỉ dành cho quản trị viên trở lên. |
| `autodown` | Tự động tải nội dung từ link được hỗ trợ. |
| `sing`, `singfb` | Tìm và gửi nhạc/audio. |
| `rupload` | Upload media qua luồng upload Facebook. |
| `name` | Tạo ảnh chữ cái NASA Landsat từ tên. |
| `anti` | Quản lý các chế độ bảo vệ nhóm. |
| `noti` | Cấu hình thông báo và top tương tác. |

Một số lệnh có thể phụ thuộc vào quyền, cấu hình bot và API key.

### Tác Giả

Created by **Hoàng Đình Quyết (HoangDev)**.

### License

ISC. You can change the license before publishing if your repository uses another license.
