interface KeywordCount {
    [key: string]: number;
}

export class KeywordExtractor {
    private maxTags: number;
    private stopwordsKo: Set<string>;
    private stopwordsEn: Set<string>;
    private suffixPattern: RegExp;

    constructor(maxTags: number = 10) {
        this.maxTags = maxTags;

        this.stopwordsKo = new Set([
            '이', '그', '저', '것', '수', '등', '및', '의', '가', '을', '를',
            '에', '에서', '으로', '로', '와', '과', '도', '만', '하다',
            '있다', '없다', '되다', '이다', '아니다', '하고', '한다',
            '이는', '이하', '따라', '통해', '위한', '대한', '관한',
            '때문', '경우', '이후', '다른', '여러', '같은', '다양한',
            '중요한', '필요한', '가능한', '직접적인', '장기적인',
            '배경지식', '결론', '맥락', '관계'
        ]);

        this.stopwordsEn = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at',
            'to', 'for', 'of', 'with', 'by', 'from', 'is', 'was',
            'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had'
        ]);

        this.suffixPattern = /(?:은|는|이|가|을|를|의|에|에서|으로|로|와|과|도|만|부터|까지|처럼|같이|보다|라고|라는|이라|라며|에도|에는|으로는|에서는|이나|나|든지|든가|이란|란|이면|면|하면|다면|라면|해서|해도|하는|하고|하며|해야|입니다|합니다|됩니다|습니다|ㅂ니다|니다)$/;
    }

    extractKeywords(text: string, title: string = ''): string[] {
        const keywords: string[] = [];

        // Title keywords get triple weight
        if (title) {
            const titleKeywords = this.extractGeneralKeywords(title);
            keywords.push(...titleKeywords, ...titleKeywords, ...titleKeywords);
        }

        // Proper nouns get double weight
        const properNouns = this.extractProperNouns(text);
        keywords.push(...properNouns, ...properNouns);

        // Body keywords
        const bodyKeywords = this.extractGeneralKeywords(text);
        keywords.push(...bodyKeywords);

        // Numbers and dates
        const numbers = this.extractNumbers(text);
        keywords.push(...numbers);

        // Count frequency and get top keywords
        const keywordFreq = this.countFrequency(keywords);
        const topKeywords = this.getTopKeywords(keywordFreq, this.maxTags);

        return topKeywords;
    }

    private extractGeneralKeywords(text: string): string[] {
        const keywords: string[] = [];

        // Korean words
        const koPattern = /[가-힣]{2,}/g;
        const koMatches = text.match(koPattern) || [];

        for (const word of koMatches) {
            const cleaned = this.cleanKoreanWord(word);
            if (cleaned.length >= 2 && !this.stopwordsKo.has(cleaned)) {
                keywords.push(cleaned);
            }
        }

        // English words (capitalized or acronyms)
        const enPattern = /\b[A-Z][a-zA-Z]{2,}\b|\b[A-Z]{2,}\b/g;
        const enMatches = text.match(enPattern) || [];
        const enFiltered = enMatches.filter(w => !this.stopwordsEn.has(w.toLowerCase()));
        keywords.push(...enFiltered);

        return keywords;
    }

    private cleanKoreanWord(word: string): string {
        let cleaned = word;
        let prevLength = 0;

        while (cleaned.length !== prevLength && cleaned.length >= 2) {
            prevLength = cleaned.length;
            cleaned = cleaned.replace(this.suffixPattern, '');
        }

        return cleaned;
    }

    private extractProperNouns(text: string): string[] {
        const properNouns: string[] = [];

        // Company names
        const companyPattern = /(?:주식회사|㈜)\s*([가-힣A-Za-z]+(?:\s+[가-힣A-Za-z]+)?)/g;
        let match;
        while ((match = companyPattern.exec(text)) !== null) {
            const company = match[1].trim();
            if (company.length >= 2) {
                properNouns.push(company);
            }
        }

        // Multi-word capitalized names
        const capitalizedPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g;
        const capitalizedMatches = text.match(capitalizedPattern) || [];
        properNouns.push(...capitalizedMatches);

        // Acronyms
        const acronymPattern = /\b[A-Z]{2,}\b/g;
        const acronymMatches = text.match(acronymPattern) || [];
        properNouns.push(...acronymMatches);

        return properNouns.map(pn => pn.trim()).filter(pn => pn.length > 0);
    }

    private extractNumbers(text: string): string[] {
        const numbers: string[] = [];

        // Money amounts
        const moneyPattern = /\d+(?:조|억|만)?원/g;
        const moneyMatches = text.match(moneyPattern) || [];
        numbers.push(...moneyMatches);

        // Years and dates
        const datePattern = /\d{4}년|\d{1,2}월\d{1,2}일/g;
        const dateMatches = text.match(datePattern) || [];
        numbers.push(...dateMatches);

        // Large numbers with units
        const largeNumPattern = /\d+(?:,\d{3})*(?:명|건|회|개)/g;
        const largeNumMatches = text.match(largeNumPattern) || [];
        numbers.push(...largeNumMatches);

        return numbers;
    }

    private countFrequency(keywords: string[]): KeywordCount {
        const freq: KeywordCount = {};

        for (const keyword of keywords) {
            freq[keyword] = (freq[keyword] || 0) + 1;
        }

        return freq;
    }

    private getTopKeywords(freq: KeywordCount, topN: number): string[] {
        const sorted = Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .map(([keyword]) => keyword)
            .slice(0, topN);

        return sorted;
    }
}