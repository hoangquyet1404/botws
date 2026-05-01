"use strict";

const axios = require("axios");
const fs = require("fs");
const path = require("path");

const BASE_IMAGE_URL = "https://science.nasa.gov/specials/your-name-in-landsat/images";
const CACHE_DIR = path.join(__dirname, "cache");
const MAX_LETTERS = 30;
const ATTACHMENTS_PER_MESSAGE = 10;

const LETTER_VARIANTS = Object.freeze({
    a: [0, 1, 2, 3, 4],
    b: [0, 1],
    c: [0, 1, 2],
    d: [0, 1],
    e: [0, 1, 2, 3],
    f: [0, 1],
    g: [0],
    h: [0, 1],
    i: [0, 1, 2, 3, 4],
    j: [0, 1, 2],
    k: [0, 1],
    l: [0, 1, 2, 3],
    m: [0, 1, 2],
    n: [0, 1, 2],
    o: [0, 1],
    p: [0, 1],
    q: [0, 1],
    r: [0, 1, 2, 3],
    s: [0, 1, 2],
    t: [0, 1],
    u: [0, 1],
    v: [0, 1, 2, 3],
    w: [0, 1],
    x: [0, 1, 2],
    y: [0, 1, 2],
    z: [0, 1]
});

const LANDSAT_LOCATIONS = Object.freeze({
    a_0: ["Hickman, Kentucky", "36°35'20.8 N 89°20'26.9 W"],
    a_1: ["Farm Island, Maine", "45°43'43.8 N 69°46'08.9 W"],
    a_2: ["Lake Guakhmaz, Azerbaijan", "40°39'50.8 N 47°06'36.2 E"],
    a_3: ["Yukon Delta, Alaska", "62°33'17.7 N 164°56'10.3 W"],
    a_4: ["Lake Mjosa, Norway", "60°45'52.7 N 10°56'43.2 E"],
    b_0: ["Holla Bend, Arkansas", "35°08'41.1 N 93°03'16.5 W"],
    b_1: ["Humaita, Brazil", "7°37'00.1 S 62°55'17.0 W"],
    c_0: ["Black Rock Desert, Nevada", "40°47'15.8 N 119°12'13.0 W"],
    c_1: ["Deception Island, Antarctica", "62°57'22.3 S 60°38'32.8 W"],
    c_2: ["False River, Louisiana", "30°38'39.7 N 91°26'45.7 W"],
    d_0: ["Akimiski Island, Canada", "53°00'58.5 N 81°18'24.6 W"],
    d_1: ["Lake Tandou, Australia", "32°37'17.8 S 142°04'21.4 E"],
    e_0: ["Firn-filled Fjords, Tibet", "29°15'46.9 N 96°19'03.8 E"],
    e_1: ["Sea of Okhotsk", "54°42'50.3 N 136°34'20.4 E"],
    e_2: ["Bellona Plateau", "20°30'00.0 S 158°30'00.0 E"],
    e_3: ["Breidamerkurjokull Glacier, Iceland", "64°05'45.0 N 16°21'45.6 W"],
    f_0: ["Mato Grosso, Brazil", "13°50'26.9 S 55°17'55.0 W"],
    f_1: ["Kruger National Park, South Africa", "28°44'01.3 S 29°12'30.1 E"],
    g_0: ["Fonte Boa, Amazonas", "2°26'30.8 S 66°16'43.7 W"],
    h_0: ["Southwestern Kyrgyzstan", "40°14'03.6 N 71°14'22.8 E"],
    h_1: ["Khorinsky District, Russia", "52°02'50.4 N 109°46'51.2 E"],
    i_0: ["Borgarbyggd, Iceland", "64°45'46.4 N 22°27'28.0 W"],
    i_1: ["Canandaigua Lake, New York", "42°47'11.0 N 77°42'58.1 W"],
    i_2: ["Etosha National Park, Namibia", "18°29'15.2 S 16°10'14.6 E"],
    i_3: ["Djebel Ouarkziz, Morocco", "28°18'01.5 N 10°33'58.5 W"],
    i_4: ["Holuhraun Ice Field, Iceland", "64°51'11.2 N 16°49'37.2 W"],
    j_0: ["Great Barrier Reef", "18°20'55.3 S 146°50'51.4 E"],
    j_1: ["Karakaya Dam, Turkey", "38°29'37.7 N 38°26'39.5 E"],
    j_2: ["Lake Superior, North America", "46°41'10.2 N 90°23'11.5 W"],
    k_0: ["Sirmilik National Park, Canada", "72°05'01.1 N 76°48'42.9 W"],
    k_1: ["Golmud, China", "35°36'46.3 N 95°03'45.9 E"],
    l_0: ["Nusantara, Indonesia", "0°58'18.1 S 116°41'58.9 E"],
    l_1: ["Xinjiang, China", "40°04'02.8 N 77°40'00.7 E"],
    l_2: ["Regina, Saskatchewan, Canada", "50°11'51.7 N 104°17'15.4 W"],
    l_3: ["Regina, Saskatchewan, Canada", "50°12'41.3 N 104°43'38.1 W"],
    m_0: ["Shenandoah River, Virginia", "38°46'32.2 N 78°24'07.1 W"],
    m_1: ["Potomac River", "38°46'32.2 N 78°24'07.1 W"],
    m_2: ["Tian Shan Mountains, Kyrgyzstan", "42°07'16.4 N 80°02'44.1 E"],
    n_0: ["Yapacani, Bolivia", "17°18'29.7 S 63°53'19.0 W"],
    n_1: ["Yapacani, Bolivia", "17°18'29.7 S 63°53'19.0 W"],
    n_2: ["Sao Miguel do Araguaia, Brazil", "12°56'44.3 S 50°29'42.0 W"],
    o_0: ["Crater Lake, Oregon", "42°56'10.0 N 122°06'04.7 W"],
    o_1: ["Manicouagan Reservoir", "51°22'42.4 N 68°40'27.2 W"],
    p_0: ["Mackenzie River Delta, Canada", "68°12'54.4 N 134°23'15.3 W"],
    p_1: ["Riberalta, Bolivia", "10°52'44.0 S 66°02'52.0 W"],
    q_0: ["Lonar Crater, India", "19°58'36.8 N 76°30'30.6 E"],
    q_1: ["Mount Tambora, Indonesia", "8°14'31.3 S 117°59'31.2 E"],
    r_0: ["Lago Menendez, Argentina", "42°41'14.9 S 71°52'21.7 W"],
    r_1: ["Province of Sondrio, Italy", "46°17'38.3 N 9°25'14.5 E"],
    r_2: ["Florida Keys", "24°45'30.4 N 81°31'53.6 W"],
    r_3: ["Canyonlands National Park, Utah", "38°26'27.8 N 109°45'03.3 W"],
    s_0: ["Mackenzie River", "68°25'01.0 N 134°08'35.2 W"],
    s_1: ["N'Djamena, Chad", "12°00'27.7 N 15°03'46.2 E"],
    s_2: ["Rio Chapare, Bolivia", "16°56'04.7 S 65°13'44.2 W"],
    t_0: ["Liwa, United Arab Emirates", "23°10'30.0 N 53°47'52.8 E"],
    t_1: ["Lena River Delta", "72°52'40.3 N 129°31'51.5 E"],
    u_0: ["Canyonlands National Park, Utah", "38°16'09.1 N 109°55'32.7 W"],
    u_1: ["Bamforth National Wildlife Refuge, Wyoming", "41°19'26.0 N 105°46'13.9 W"],
    u_2: ["Potomac River, Virginia", "38°29'06.4 N 77°10'19.9 W"],
    v_0: ["Cellina and Meduna Rivers, Italy", "46°06'41.4 N 12°45'26.6 E"],
    v_1: ["New South Wales, Australia", "34°17'11.2 S 150°49'32.4 E"],
    v_2: ["Padma River, Bangladesh", "23°21'03.9 N 90°33'06.9 E"],
    v_3: ["Mapleton, Maine", "46°32'40.5 N 68°15'06.4 W"],
    w_0: ["Ponoy River, Russia", "67°02'10.9 N 40°20'19.3 E"],
    w_1: ["La Primavera, Columbia", "5°26'57.9 N 69°47'57.0 W"],
    x_0: ["Wolstenholme Fjord, Greenland", "76°44'03.8 N 68°36'23.3 W"],
    x_1: ["Davis Strait, Greenland", "62°14'14.8 N 49°34'49.9 W"],
    x_2: ["Sermersooq Municipality, Greenland", "66°37'05.2 N 36°22'05.9 W"],
    y_0: ["Biobio River, Chile", "37°16'02.4 S 72°43'42.9 W"],
    y_1: ["Estuario de Virrila, Peru", "5°51'53.4 S 80°43'51.6 W"],
    y_2: ["Ramsay, New Zealand", "43°31'19.4 S 170°49'53.7 E"],
    z_0: ["Primavera do Leste, Brazil", "15°29'38.9 S 54°20'27.5 W"],
    z_1: ["Mohammed Boudiaf, Algeria", "34°59'19.3 N 4°23'20.8 E"]
});

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createVariantPools() {
    const pools = {};

    for (const [letter, variants] of Object.entries(LETTER_VARIANTS)) {
        pools[letter] = variants.slice();
    }

    return pools;
}

function pickLetterImage(letter, pools) {
    const key = letter.toLowerCase();
    const variants = LETTER_VARIANTS[key];

    if (!variants) {
        return null;
    }

    const pool = pools[key];
    if (pool && pool.length > 0) {
        const index = randomInt(0, pool.length - 1);
        const variant = pool[index];
        pool.splice(index, 1);
        return `${key}_${variant}`;
    }

    const min = variants[0];
    const max = variants[variants.length - 1];
    return `${key}_${randomInt(min, max)}`;
}

function buildImageCodes(input) {
    const pools = createVariantPools();
    const codes = [];

    for (const char of input) {
        if (char === " ") {
            codes.push(null);
            continue;
        }

        const code = pickLetterImage(char, pools);
        if (code) {
            codes.push(code);
        }
    }

    return codes;
}

function makeImageUrl(code) {
    return `${BASE_IMAGE_URL}/${code}.jpg`;
}

function formatLocationLine(code, index) {
    const location = LANDSAT_LOCATIONS[code];
    if (!location) {
        return `${index}. ${code.toUpperCase()} - Khong co thong tin vi tri`;
    }

    return `${index}. ${code.toUpperCase()} - ${location[0]} | ${location[1]}`;
}

async function downloadImage(code, index) {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }

    const filePath = path.join(CACHE_DIR, `landsat_${Date.now()}_${index}_${code}.jpg`);
    const response = await axios.get(makeImageUrl(code), {
        responseType: "arraybuffer",
        timeout: 30000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        validateStatus: (status) => status >= 200 && status < 300
    });

    fs.writeFileSync(filePath, Buffer.from(response.data));
    return {
        code,
        filePath
    };
}

function cleanupFiles(items) {
    for (const item of items) {
        try {
            if (item && item.filePath && fs.existsSync(item.filePath)) {
                fs.unlinkSync(item.filePath);
            }
        } catch {
            // Ignore cache cleanup failures.
        }
    }
}

function sendMessage(api, message, threadID, replyToMessageID) {
    return new Promise((resolve, reject) => {
        api.sendMessage(message, threadID, (error, info) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(info);
        }, replyToMessageID);
    });
}

module.exports = {
    config: {
        name: "name",
        aliases: ["landsat", "nasa"],
        version: "1.0.0",
        role: 0,
        author: "Admin",
        info: "Tao chu bang anh NASA Landsat",
        Category: "Box",
        guides: "<chu A-Z>",
        cd: 2,
        hasPrefix: true,
        images: []
    },

    onRun: async function ({ api, event, args }) {
        const { threadID, messageID } = event;
        const input = args.join(" ").trim();

        if (!input) {
            return api.sendMessage("Dung: name <chu A-Z>\nVi du: name an", threadID, null, messageID);
        }

        if (!/^[ A-Za-z]+$/.test(input)) {
            return api.sendMessage("Chi ho tro chu cai A-Z va khoang trang.", threadID, null, messageID);
        }

        const letterCount = (input.match(/[A-Za-z]/g) || []).length;
        if (letterCount === 0) {
            return api.sendMessage("Vui long nhap it nhat 1 chu cai.", threadID, null, messageID);
        }

        if (letterCount > MAX_LETTERS) {
            return api.sendMessage(`Toi da ${MAX_LETTERS} chu cai de tranh gui qua nhieu anh.`, threadID, null, messageID);
        }

        let downloaded = [];

        try {
            const codesWithSpaces = buildImageCodes(input);
            const codes = codesWithSpaces.filter(Boolean);
            downloaded = await Promise.all(codes.map((code, index) => downloadImage(code, index)));

            for (let index = 0; index < downloaded.length; index += ATTACHMENTS_PER_MESSAGE) {
                const chunk = downloaded.slice(index, index + ATTACHMENTS_PER_MESSAGE);
                const streams = chunk.map((item) => fs.createReadStream(item.filePath));
                const firstChunk = index === 0;
                const message = {
                    attachment: streams.length === 1 ? streams[0] : streams
                };

                if (firstChunk) {
                    const codeLine = codesWithSpaces
                        .map((code) => (code ? code.toUpperCase() : "/"))
                        .join(" ");
                    const locationLines = codes
                        .map((code, itemIndex) => formatLocationLine(code, itemIndex + 1))
                        .join("\n");
                    message.body = `NASA Landsat: ${input}\n${codeLine}\n\nVi tri anh:\n${locationLines}`;
                }

                await sendMessage(api, message, threadID, firstChunk ? messageID : null);
                cleanupFiles(chunk);
            }

            downloaded = [];
        } catch (error) {
            console.error("[name] Error:", error);
            cleanupFiles(downloaded);
            return api.sendMessage(`Loi: ${error.message || error}`, threadID, null, messageID);
        }
    }
};
