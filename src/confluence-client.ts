import axios, { AxiosInstance } from 'axios';
import { config } from 'dotenv';

config(); // Load environment variables

export interface ConfluenceAuth {
  domain: string;
  email: string;
  apiToken: string;
}

export class ConfluenceClient {
  private client: AxiosInstance;
  private domain: string;

  constructor(auth: ConfluenceAuth) {
    this.domain = auth.domain;
    this.client = axios.create({
      baseURL: `https://${auth.domain}/rest/api`,
      auth: {
        username: auth.email,
        password: auth.apiToken
      },
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
  }

  // Space operations
  async getSpaces(limit = 25, start = 0) {
    const response = await this.client.get('/spaces', {
      params: { limit, start }
    });
    return response.data;
  }

  async getSpace(spaceId: string) {
    const response = await this.client.get(`/spaces/${spaceId}`);
    return response.data;
  }

  // Page operations
  async getPages(spaceId: string, limit = 25, start = 0) {
    const response = await this.client.get('/pages', {
      params: { 
        spaceId,
        limit,
        start,
        status: 'current'
      }
    });
    return response.data;
  }

  async getPage(pageId: string) {
    const response = await this.client.get(`/pages/${pageId}`);
    return response.data;
  }

  async getPageContent(pageId: string) {
    const response = await this.client.get(`/pages/${pageId}/body`, {
      params: {
        body_format: 'storage'
      }
    });
    return response.data;
  }

  async createPage(spaceId: string, title: string, content: string, parentId?: string) {
    const body = {
      spaceId,
      status: 'current',
      title,
      body: {
        representation: 'storage',
        value: content
      },
      ...(parentId && { parentId })
    };

    const response = await this.client.post('/pages', body);
    return response.data;
  }

  async updatePage(pageId: string, title: string, content: string, version: number) {
    const body = {
      id: pageId,
      status: 'current',
      title,
      body: {
        representation: 'storage',
        value: content
      },
      version: {
        number: version + 1,
        message: `Updated via MCP at ${new Date().toISOString()}`
      }
    };

    const response = await this.client.put(`/pages/${pageId}`, body);
    return response.data;
  }

  // Search operations
  async searchContent(query: string, limit = 25, start = 0) {
    const response = await this.client.get('/search', {
      params: {
        cql: query,
        limit,
        start
      }
    });
    return response.data;
  }

  // Labels operations
  async getLabels(pageId: string) {
    const response = await this.client.get(`/pages/${pageId}/labels`);
    return response.data;
  }

  async addLabel(pageId: string, label: string) {
    const response = await this.client.post(`/pages/${pageId}/labels`, {
      name: label
    });
    return response.data;
  }

  async removeLabel(pageId: string, label: string) {
    await this.client.delete(`/pages/${pageId}/labels/${label}`);
  }
}
