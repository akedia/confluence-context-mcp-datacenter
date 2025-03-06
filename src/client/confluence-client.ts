import axios, { AxiosInstance } from 'axios';

import { ConfluenceError } from '../types/index.js';
import type { 
  ConfluenceConfig, 
  Space, 
  Page, 
  Label, 
  SearchResult, 
  PaginatedResponse,
  SimplifiedPage
} from '../types/index.js';

export class ConfluenceClient {
  private client: AxiosInstance;
  private domain: string;
  private baseURL: string;
  private apiPath: string;

  constructor(config: ConfluenceConfig) {
    this.domain = config.domain;
    this.baseURL = `https://${config.domain}`;
    this.apiPath = '/rest/api';
    
    // Confluence Data Center API client
    this.client = axios.create({
      baseURL: this.baseURL + this.apiPath,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')}`,
        'X-Atlassian-Token': 'no-check'
      }
    });

    // Log configuration for debugging
    console.error('Confluence Data Center client configured with domain:', config.domain);
  }

  // Verify connection to Confluence API - throws error if verification fails
  async verifyApiConnection(): Promise<void> {
    try {
      // Make a simple API call that should work with minimal permissions
      await this.client.get('/space', { params: { limit: 1 } });
      process.stderr.write('Successfully connected to Confluence API\n');
    } catch (error) {
      let errorMessage = 'Failed to connect to Confluence API';
      
      if (axios.isAxiosError(error)) {
        // Extract detailed error information
        const errorDetails = {
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message
        };
        
        // Provide specific error messages based on status code
        if (error.response && error.response.status === 401) {
          errorMessage = 'Authentication failed: Invalid API token or email';
        } else if (error.response && error.response.status === 403) {
          errorMessage = 'Authorization failed: Insufficient permissions';
        } else if (error.response && error.response.status === 404) {
          errorMessage = 'API endpoint not found: Check Confluence domain';
        } else if (error.response && error.response.status >= 500) {
          errorMessage = 'Confluence server error: API may be temporarily unavailable';
        }
        
        console.error(`${errorMessage}:`, errorDetails);
      } else {
        console.error(errorMessage + ':', error instanceof Error ? error.message : String(error));
      }
      
      // Throw error with detailed message to fail server initialization
      throw new Error(errorMessage);
    }
  }

  // Space operations
  async getConfluenceSpaces(limit = 25, start = 0): Promise<PaginatedResponse<Space>> {
    const response = await this.client.get('/space', {
      params: { limit, start }
    });
    
    // Transform response to match expected format
    return {
      results: response.data.results,
      _links: response.data._links,
      size: response.data.size
    };
  }

  async getConfluenceSpace(spaceKey: string): Promise<Space> {
    const response = await this.client.get(`/space/${spaceKey}`);
    // Transform Data Center response to expected format
    return {
      id: response.data.id,
      key: response.data.key,
      name: response.data.name,
      type: response.data.type,
      status: response.data.status,
      _links: response.data._links
    };
  }

  // Page operations
  async getConfluencePages(spaceKey: string, limit = 25, start = 0, title?: string): Promise<PaginatedResponse<Page>> {
    const cql = [`space = "${spaceKey}"`, `type = "page"`];
    if (title) {
      cql.push(`title ~ "${title}"`);
    }
    
    const response = await this.client.get('/content/search', {
      params: {
        cql: cql.join(' AND '),
        limit,
        start,
        expand: 'space,version,body.storage'
      }
    });
    
    // Transform Data Center response to expected format
    return {
      results: response.data.results.map((page: any) => ({
        id: page.id,
        title: page.title,
        status: page.status,
        spaceId: page.space?.id,
        _links: page._links,
        version: page.version,
        body: page.body,
        authorId: page.history?.createdBy?.accountId || 'unknown',
        createdAt: page.history?.createdDate || new Date().toISOString()
      })),
      _links: response.data._links,
      size: response.data.size
    };
  }

  async searchPageByName(title: string, spaceKey?: string): Promise<Page[]> {
    try {
      const cql = [`title ~ "${title}"`, `type = "page"`];
      if (spaceKey) {
        cql.push(`space = "${spaceKey}"`);
      }
      
      const response = await this.client.get('/content/search', {
        params: {
          cql: cql.join(' AND '),
          limit: 10,
          expand: 'space,version'
        }
      });
      
      // Transform Data Center response format
      return response.data.results.map((page: any) => ({
        id: page.id,
        title: page.title,
        status: page.status,
        spaceId: page.space?.id,
        _links: page._links,
        version: page.version,
        authorId: page.history?.createdBy?.accountId || 'unknown',
        createdAt: page.history?.createdDate || new Date().toISOString()
      }));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Error searching for page:', error.message);
        throw new ConfluenceError(
          `Failed to search for page: ${error.message}`,
          'UNKNOWN'
        );
      }
      throw error;
    }
  }

  async getPageContent(pageId: string): Promise<string> {
    try {
      console.error(`Fetching content for page ${pageId}`);
      
      const response = await this.client.get(`/content/${pageId}`, {
        params: {
          expand: 'body.storage'
        }
      });
      
      const content = response.data.body?.storage?.value;
      
      if (!content) {
        throw new ConfluenceError(
          'Page content is empty or not accessible',
          'EMPTY_CONTENT'
        );
      }

      return content;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new ConfluenceError(
            'Page content not found',
            'PAGE_NOT_FOUND'
          );
        }
        if (error.response?.status === 403) {
          throw new ConfluenceError(
            'Insufficient permissions to access page content',
            'INSUFFICIENT_PERMISSIONS'
          );
        }
        throw new ConfluenceError(
          `Failed to get page content: ${error.message}`,
          'UNKNOWN'
        );
      }
      throw error;
    }
  }

  async getConfluencePage(pageId: string): Promise<Page> {
    try {
      // Get page with content
      const response = await this.client.get(`/content/${pageId}`, {
        params: {
          expand: 'space,version,body.storage'
        }
      });
      
      const page = response.data;
      
      // Transform Data Center response to expected format
      return {
        id: page.id,
        title: page.title,
        status: page.status,
        spaceId: page.space?.id,
        _links: page._links,
        version: page.version,
        body: page.body,
        authorId: page.history?.createdBy?.accountId || 'unknown',
        createdAt: page.history?.createdDate || new Date().toISOString()
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Error fetching page:', error.message);
        throw error;
      }
      console.error('Error fetching page:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to fetch page content');
    }
  }

  async createConfluencePage(spaceKey: string, title: string, content: string, parentId?: string): Promise<Page> {
    const body = {
      type: 'page',
      title,
      space: {
        key: spaceKey
      },
      body: {
        storage: {
          value: content,
          representation: 'storage'
        }
      },
      ...(parentId && { 
        ancestors: [{ 
          id: parentId 
        }]
      })
    };

    const response = await this.client.post('/content', body);
    
    // Transform Data Center response to expected format
    const page = response.data;
    return {
      id: page.id,
      title: page.title,
      status: page.status,
      spaceId: page.space?.id,
      _links: page._links,
      version: page.version,
      authorId: page.history?.createdBy?.accountId || 'unknown',
      createdAt: page.history?.createdDate || new Date().toISOString()
    };
  }

  async updateConfluencePage(pageId: string, title: string, content: string, version: number): Promise<Page> {
    // First get the current page to ensure we have all required fields
    const currentPage = await this.client.get(`/content/${pageId}`);
    
    const body = {
      type: 'page',
      title,
      body: {
        storage: {
          value: content,
          representation: 'storage'
        }
      },
      version: {
        number: version + 1,
        message: `Updated via MCP at ${new Date().toISOString()}`
      }
    };

    const response = await this.client.put(`/content/${pageId}`, body);
    
    // Transform Data Center response to expected format
    const page = response.data;
    return {
      id: page.id,
      title: page.title,
      status: page.status,
      spaceId: page.space?.id,
      _links: page._links,
      version: page.version,
      authorId: page.history?.createdBy?.accountId || 'unknown',
      createdAt: page.history?.createdDate || new Date().toISOString()
    };
  }

  // Search operations
  async searchConfluenceContent(query: string, limit = 25, start = 0): Promise<SearchResult> {
    try {
      console.error('Searching Confluence with CQL:', query);
      
      const response = await this.client.get('/content/search', {
        params: {
          cql: query.includes('type =') ? query : `text ~ "${query}"`,
          limit,
          start,
          expand: 'space,version,body.view'
        }
      });

      console.error(`Found ${response.data.results?.length || 0} results`);

      return {
        results: (response.data.results || []).map((result: any) => ({
          content: {
            id: result.id,
            type: result.type,
            status: result.status,
            title: result.title,
            spaceId: result.space?.id,
            _links: result._links
          },
          url: `https://${this.domain}/wiki${result._links?.webui || ''}`,
          lastModified: result.version?.when,
          excerpt: result.excerpt || ''
        })),
        _links: {
          next: response.data._links?.next,
          base: this.baseURL + this.apiPath
        }
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Error searching content:', error.message, error.response?.data);
        throw new ConfluenceError(
          `Failed to search content: ${error.message}`,
          'SEARCH_FAILED'
        );
      }
      throw error;
    }
  }

  // Labels operations
  async getConfluenceLabels(pageId: string): Promise<PaginatedResponse<Label>> {
    const response = await this.client.get(`/content/${pageId}/label`);
    return {
      results: response.data.results,
      _links: response.data._links,
      size: response.data.size
    };
  }

  async addConfluenceLabel(pageId: string, label: string): Promise<Label> {
    try {
      console.error(`Adding label ${label} to page ${pageId}`);
      
      // Data Center API requires an array of labels
      const response = await this.client.post(`/content/${pageId}/label`, [{
        prefix: 'global',
        name: label
      }]);
      
      // Return the first label from the response
      return response.data.results[0];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new ConfluenceError(
            'Page not found',
            'PAGE_NOT_FOUND'
          );
        }
        
        console.error('Error adding label:', error.message, error.response?.data);
        
        // Handle duplicate label
        if (error.response?.data?.message?.includes('already has the label')) {
          throw new ConfluenceError(
            `Label "${label}" already exists on this page`,
            'LABEL_EXISTS'
          );
        }
        
        throw new ConfluenceError(
          `Failed to add label: ${error.message}`,
          'UNKNOWN'
        );
      }
      throw error;
    }
  }

  async removeConfluenceLabel(pageId: string, label: string): Promise<void> {
    try {
      await this.client.delete(`/content/${pageId}/label`, {
        params: {
          name: label
        }
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          // Either page or label not found
          const data = error.response.data;
          if (data?.message?.includes('label')) {
            throw new ConfluenceError(
              `Label "${label}" not found on page`,
              'LABEL_NOT_FOUND'
            );
          } else {
            throw new ConfluenceError(
              'Page not found',
              'PAGE_NOT_FOUND'
            );
          }
        }
        
        throw new ConfluenceError(
          `Failed to remove label: ${error.message}`,
          'UNKNOWN'
        );
      }
      throw error;
    }
  }
}
