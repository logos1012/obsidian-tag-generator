import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import { KeywordExtractor } from './keyword-extractor';
import { AIService } from './ai-service';

interface TagGeneratorSettings {
    maxTags: number;
    overwriteExistingTags: boolean;
    excludeFolders: string[];
    minWordLength: number;
    useAI: boolean;
    openaiApiKey: string;
    model: string;
}

const DEFAULT_SETTINGS: TagGeneratorSettings = {
    maxTags: 10,
    overwriteExistingTags: false,
    excludeFolders: [],
    minWordLength: 2,
    useAI: false,
    openaiApiKey: '',
    model: 'gpt-3.5-turbo'
};

export default class TagGeneratorPlugin extends Plugin {
    settings: TagGeneratorSettings;
    keywordExtractor: KeywordExtractor;
    aiService: AIService;

    async onload() {
        await this.loadSettings();
        this.keywordExtractor = new KeywordExtractor(this.settings.maxTags);
        this.aiService = new AIService({
            openaiApiKey: this.settings.openaiApiKey,
            model: this.settings.model,
            useAI: this.settings.useAI
        });

        // Add ribbon icon
        this.addRibbonIcon('tag', 'Generate Tags', () => {
            this.generateTagsForActiveNote();
        });

        // Add command for generating tags for current note
        this.addCommand({
            id: 'generate-tags-current',
            name: 'Generate tags for current note',
            editorCallback: (editor: Editor, view: MarkdownView) => {
                this.generateTagsForNote(view.file);
            }
        });

        // Add command for generating tags for all notes
        this.addCommand({
            id: 'generate-tags-all',
            name: 'Generate tags for all notes in vault',
            callback: () => {
                this.generateTagsForAllNotes();
            }
        });

        // Add settings tab
        this.addSettingTab(new TagGeneratorSettingTab(this.app, this));
    }

    async generateTagsForActiveNote() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('No active file');
            return;
        }
        await this.generateTagsForNote(activeFile);
    }

    async generateTagsForNote(file: TFile | null) {
        if (!file) {
            new Notice('No file selected');
            return;
        }

        // Check if file is in excluded folder
        if (this.isFileExcluded(file)) {
            new Notice(`File is in excluded folder: ${file.path}`);
            return;
        }

        try {
            const content = await this.app.vault.read(file);
            const fileCache = this.app.metadataCache.getFileCache(file);

            // Extract title and body text
            const title = file.basename;
            const bodyText = this.extractBodyText(content);

            // Generate tags
            let tags = this.keywordExtractor.extractKeywords(bodyText, title);

            // Use AI to refine tags if enabled
            if (this.settings.useAI && this.settings.openaiApiKey) {
                new Notice('Refining tags with AI...');
                tags = await this.aiService.refineTags(tags, bodyText);
            }

            if (tags.length === 0) {
                new Notice('No tags generated for this note');
                return;
            }

            // Update frontmatter
            await this.updateFrontmatterTags(file, content, tags, fileCache);

            new Notice(`Generated ${tags.length} tags for ${file.basename}`);
        } catch (error) {
            console.error('Error generating tags:', error);
            new Notice(`Error generating tags: ${error.message}`);
        }
    }

    async generateTagsForAllNotes() {
        const files = this.app.vault.getMarkdownFiles();
        let processedCount = 0;
        let skippedCount = 0;

        new Notice(`Processing ${files.length} files...`);

        for (const file of files) {
            if (this.isFileExcluded(file)) {
                skippedCount++;
                continue;
            }

            try {
                await this.generateTagsForNote(file);
                processedCount++;
            } catch (error) {
                console.error(`Error processing ${file.path}:`, error);
            }
        }

        new Notice(`Processed ${processedCount} files, skipped ${skippedCount} files`);
    }

    extractBodyText(content: string): string {
        // Remove frontmatter if exists
        const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
        let bodyContent = content.replace(frontmatterRegex, '');

        // Remove code blocks
        bodyContent = bodyContent.replace(/```[\s\S]*?```/g, '');
        bodyContent = bodyContent.replace(/`[^`]+`/g, '');

        // Remove links but keep link text
        bodyContent = bodyContent.replace(/\[\[([^\]]+)\]\]/g, '$1');
        bodyContent = bodyContent.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

        // Remove markdown formatting
        bodyContent = bodyContent.replace(/[#*_~]/g, '');

        return bodyContent;
    }

    async updateFrontmatterTags(file: TFile, content: string, tags: string[], fileCache: any) {
        const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
        const frontmatterMatch = content.match(frontmatterRegex);

        let newContent: string;

        if (frontmatterMatch) {
            // Has existing frontmatter
            const frontmatter = frontmatterMatch[1];
            const existingTagsMatch = frontmatter.match(/^tags:\s*(.*)$/m);

            if (existingTagsMatch && !this.settings.overwriteExistingTags) {
                // Parse existing tags
                const existingTagsStr = existingTagsMatch[1];
                let existingTags: string[] = [];

                // Handle different tag formats
                if (existingTagsStr.startsWith('[')) {
                    // Array format: [tag1, tag2]
                    existingTags = existingTagsStr
                        .replace(/[\[\]]/g, '')
                        .split(',')
                        .map(t => t.trim())
                        .filter(t => t);
                } else {
                    // String format or empty
                    const tagStr = existingTagsStr.trim();
                    if (tagStr) {
                        existingTags = [tagStr];
                    }
                }

                // Merge tags (remove duplicates)
                const mergedTags = [...new Set([...existingTags, ...tags])];

                // Update tags in frontmatter
                const newFrontmatter = frontmatter.replace(
                    /^tags:.*$/m,
                    `tags:\n${mergedTags.map(t => `  - ${t}`).join('\n')}`
                );

                newContent = content.replace(frontmatterRegex, `---\n${newFrontmatter}\n---\n`);
            } else {
                // Overwrite existing tags or add new tags field
                let newFrontmatter: string;

                if (existingTagsMatch) {
                    // Replace existing tags
                    newFrontmatter = frontmatter.replace(
                        /^tags:.*$/m,
                        `tags:\n${tags.map(t => `  - ${t}`).join('\n')}`
                    );
                } else {
                    // Add tags field
                    newFrontmatter = frontmatter + `\ntags:\n${tags.map(t => `  - ${t}`).join('\n')}`;
                }

                newContent = content.replace(frontmatterRegex, `---\n${newFrontmatter}\n---\n`);
            }
        } else {
            // No frontmatter, create new
            const frontmatter = `---\ntags:\n${tags.map(t => `  - ${t}`).join('\n')}\n---\n`;
            newContent = frontmatter + content;
        }

        await this.app.vault.modify(file, newContent);
    }

    isFileExcluded(file: TFile): boolean {
        for (const excludedFolder of this.settings.excludeFolders) {
            if (file.path.startsWith(excludedFolder)) {
                return true;
            }
        }
        return false;
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        // Update keyword extractor with new settings
        this.keywordExtractor = new KeywordExtractor(this.settings.maxTags);
        // Update AI service settings
        this.aiService.updateSettings({
            openaiApiKey: this.settings.openaiApiKey,
            model: this.settings.model,
            useAI: this.settings.useAI
        });
    }
}

class TagGeneratorSettingTab extends PluginSettingTab {
    plugin: TagGeneratorPlugin;

    constructor(app: App, plugin: TagGeneratorPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        containerEl.createEl('h2', {text: 'Tag Generator Settings'});

        containerEl.createEl('h3', {text: 'AI Settings'});

        new Setting(containerEl)
            .setName('Use AI for tag refinement')
            .setDesc('Use OpenAI to refine and improve generated tags')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useAI)
                .onChange(async (value) => {
                    this.plugin.settings.useAI = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('OpenAI API Key')
            .setDesc('Enter your OpenAI API key for AI refinement')
            .addText(text => text
                .setPlaceholder('sk-...')
                .setValue(this.plugin.settings.openaiApiKey)
                .onChange(async (value) => {
                    this.plugin.settings.openaiApiKey = value;
                    await this.plugin.saveSettings();
                }))
            .then(setting => {
                setting.controlEl.querySelector('input')?.setAttribute('type', 'password');
            });

        new Setting(containerEl)
            .setName('AI Model')
            .setDesc('Select the OpenAI model to use')
            .addDropdown(dropdown => dropdown
                .addOption('gpt-3.5-turbo', 'GPT-3.5 Turbo (Faster, Cheaper)')
                .addOption('gpt-4', 'GPT-4 (Better quality)')
                .addOption('gpt-4-turbo-preview', 'GPT-4 Turbo (Best quality)')
                .setValue(this.plugin.settings.model)
                .onChange(async (value) => {
                    this.plugin.settings.model = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', {text: 'General Settings'});

        new Setting(containerEl)
            .setName('Maximum number of tags')
            .setDesc('Maximum number of tags to generate per note')
            .addText(text => text
                .setPlaceholder('10')
                .setValue(String(this.plugin.settings.maxTags))
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.maxTags = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Overwrite existing tags')
            .setDesc('If enabled, existing tags will be replaced. If disabled, new tags will be merged with existing ones.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.overwriteExistingTags)
                .onChange(async (value) => {
                    this.plugin.settings.overwriteExistingTags = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Minimum word length')
            .setDesc('Minimum length of words to consider as tags')
            .addText(text => text
                .setPlaceholder('2')
                .setValue(String(this.plugin.settings.minWordLength))
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.minWordLength = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Excluded folders')
            .setDesc('Folders to exclude from tag generation (one per line)')
            .addTextArea(text => text
                .setPlaceholder('Templates/\nArchive/')
                .setValue(this.plugin.settings.excludeFolders.join('\n'))
                .onChange(async (value) => {
                    this.plugin.settings.excludeFolders = value
                        .split('\n')
                        .map(f => f.trim())
                        .filter(f => f.length > 0);
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', {text: 'Usage'});
        containerEl.createEl('p', {text: 'Click the tag icon in the ribbon or use the command palette to generate tags for your notes.'});
        containerEl.createEl('p', {text: 'Tags are generated based on:'});
        const list = containerEl.createEl('ul');
        list.createEl('li', {text: 'Note title (weighted higher)'});
        list.createEl('li', {text: 'Proper nouns and acronyms'});
        list.createEl('li', {text: 'Important keywords from content'});
        list.createEl('li', {text: 'Numbers, dates, and amounts'});
        if (this.plugin.settings.useAI) {
            list.createEl('li', {text: '🤖 AI refinement to remove irrelevant words and improve quality'});
        }
    }
}