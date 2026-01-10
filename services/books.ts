
/**
 * OpenBD APIを利用してISBNから書籍情報を取得します。
 * @param isbn ISBN-13 or ISBN-10 string
 * @returns Book data or null
 */
export interface BookInfo {
    title: string;
    author: string;
    publisher: string;
    description: string;
    cover: string;
}

export const searchBookByIsbn = async (isbn: string): Promise<BookInfo | null> => {
    // Clean ISBN (remove hyphens)
    const cleanIsbn = isbn.replace(/-/g, '');

    if (cleanIsbn.length !== 10 && cleanIsbn.length !== 13) {
        return null;
    }

    try {
        const response = await fetch(`https://api.openbd.jp/v1/get?isbn=${cleanIsbn}`);
        if (!response.ok) {
            throw new Error('Failed to fetch from OpenBD');
        }

        const data = await response.json();
        if (!data || data.length === 0 || data[0] === null) {
            return null;
        }

        const book = data[0];
        const summary = book.onix?.CollateralDetail?.TextContent?.[0]?.Text || "";
        const title = book.summary?.title || "";
        const author = book.summary?.author || "";
        const publisher = book.summary?.publisher || "";
        const cover = book.summary?.cover || "";

        return {
            title,
            author,
            publisher,
            description: summary,
            cover
        };

    } catch (error) {
        console.warn("OpenBD search failed:", error);
        return null;
    }
};
