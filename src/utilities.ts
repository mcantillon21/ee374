export function isJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        if (e.message == "Unexpected end of JSON input") {
            return 'partial';
        } else {
            return false;
        }
    }
    return true;
}