import { Page } from 'playwright';
import { NormalizedStudentData } from '@srm/shared';
import * as fs from 'fs';
import * as path from 'path';

export class SRMISTPortalAdapter {
  /**
   * Main entry point for extraction.
   * Takes an authenticated Playwright Page and extracts all required data.
   */
  public async extractData(page: Page): Promise<NormalizedStudentData | null> {
    try {
      console.log('[Adapter] Starting data extraction from authenticated portal...');

      // Wait for the page DOM to be fully loaded and wait for the specific profile element to appear
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      
      // Wait for either "Student Name" or "Name" to appear to ensure the profile section is loaded
      await Promise.race([
        page.waitForSelector('text="Student Name"', { timeout: 15000 }),
        page.waitForSelector('text="Register No"', { timeout: 15000 }),
        page.waitForTimeout(10000) // Fallback timeout
      ]).catch(() => {});

      await page.waitForTimeout(2000).catch(() => {});

      const profile = await this.extractDashboardProfile(page);
      console.log(`[Adapter] Extracted Profile: Name=${profile.name}, ID=${profile.id}`);

      // 1. Navigate to Course List to get credits
      console.log('[Adapter] Navigating to Course List for credits...');
      await this.navigateToForm(page, 7);
      
      const courseCredits = await this.extractCourseCredits(page);
      console.log(`[Adapter] Extracted ${Object.keys(courseCredits).length} course credits.`);

      // 2. Navigate to Attendance Details
      console.log('[Adapter] Navigating to Attendance Details...');
      await this.navigateToForm(page, 9);

      // Extract the subjects and attendance
      const { subjects, attendance } = await this.extractAttendance(page, courseCredits);
      
      console.log(`[Adapter] Extracted ${subjects.length} subjects with attendance.`);

      return {
        profile: {
          name: profile.name,
          studentId: profile.id,
          registerNumber: profile.registerNumber,
          email: profile.email,
          program: profile.program,
          department: profile.department,
          institution: profile.institution,
          status: profile.status,
          semester: profile.semester,
          imageUrl: profile.imageUrl,
        },
        currentSemester: { id: profile.semester || 'current', name: profile.semester ? `Semester ${profile.semester}` : 'Current Semester' },
        subjects,
        attendance
      };

    } catch (error) {
      console.error('[Adapter] Extraction failed:', error);
      throw error;
    }
  }

  private async extractDashboardProfile(page: Page): Promise<{ name: string; id: string; program: string; department: string; email?: string; registerNumber?: string; semester?: string; institution?: string; status?: string; imageUrl?: string; }> {
    return page.evaluate(() => {
      const getVal = (label: string) => {
        const td = Array.from(document.querySelectorAll('td')).find(el => el.textContent?.trim() === label);
        return td?.nextElementSibling?.textContent?.trim() || 'Unknown';
      };
      
      const registerNumber = getVal('Register No.');
      const semester = getVal('Semester');
      const institution = getVal('Institution');
      
      // "Current Status: Active" appears as a text node near the profile photo area
      let status: string | undefined;
      const allText = document.body.innerText || '';
      const statusMatch = allText.match(/Current Status:\s*(\w+)/i);
      if (statusMatch) status = statusMatch[1];
      // Also try via span/div text content
      if (!status) {
        const statusEl = Array.from(document.querySelectorAll('span, div, td, p')).find(el => 
          el.textContent?.trim().startsWith('Current Status:')
        );
        if (statusEl) status = statusEl.textContent?.replace('Current Status:', '').trim();
      }
      
      // Try to find the profile image. Usually it has a unique class, or it's the only large img, or near the active status.
      let imageUrl: string | undefined;
      const imgs = Array.from(document.querySelectorAll('img'));
      // Find an image that's likely the profile photo (not a small icon, not a logo)
      // Usually profile photos have src starting with data:image or some specific path, and are relatively large.
      const profileImg = imgs.find(img => img.width > 50 && img.height > 50 && !img.src.includes('logo'));
      if (profileImg) {
        imageUrl = profileImg.src;
      }
      
      return { 
        name: getVal('Student Name'), 
        id: getVal('Student ID') !== 'Unknown' ? getVal('Student ID') : registerNumber,
        registerNumber: registerNumber !== 'Unknown' ? registerNumber : undefined,
        email: getVal('Email ID') !== 'Unknown' ? getVal('Email ID') : undefined,
        program: getVal('Program'),
        department: 'Unknown',
        semester: semester !== 'Unknown' ? semester : undefined,
        institution: institution !== 'Unknown' ? institution : undefined,
        status: status || undefined,
        imageUrl: imageUrl,
      };
    });
  }


  private async navigateToForm(page: Page, formId: number): Promise<void> {
    try {
      console.log(`[Adapter] Clicking menu item #listId${formId}...`);
      await page.click(`#listId${formId}`);
      // Wait for DOM load or target table to render
      await Promise.race([
        page.waitForSelector('table.table, tbody tr', { timeout: 10000 }),
        page.waitForLoadState('domcontentloaded', { timeout: 10000 }),
        page.waitForTimeout(3000)
      ]).catch(() => {});
    } catch (e: any) {
      console.warn(`[Adapter] Warning navigating to form ${formId}:`, e.message);
    }
    await page.waitForTimeout(1000); 
  }

  private async extractCourseCredits(page: Page): Promise<Record<string, number>> {
    return page.evaluate(() => {
      const creditsMap: Record<string, number> = {};
      const tables = document.querySelectorAll('table.table');
      if (tables.length > 0) {
        // Course List table usually has headers: Code, Description, Category, Credits, etc.
        const rows = tables[0].querySelectorAll('tbody tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 4) {
            const code = cells[0]?.textContent?.trim() || '';
            const creditsStr = cells[cells.length - 1]?.textContent?.trim() || ''; 
            // Often credits are in one of the last columns, let's look for any number if not the last
            let creditVal = parseFloat(creditsStr);
            if (isNaN(creditVal)) {
              for (let i = cells.length - 1; i >= 0; i--) {
                 const v = parseFloat(cells[i]?.textContent?.trim() || '');
                 if (!isNaN(v) && v < 10) {
                   creditVal = v;
                   break;
                 }
              }
            }
            if (code && !code.includes('Total') && !isNaN(creditVal)) {
              creditsMap[code] = creditVal;
            }
          }
        });
      }
      return creditsMap;
    });
  }

  private async extractAttendance(page: Page, courseCredits: Record<string, number>): Promise<{ subjects: any[], attendance: any[] }> {
    return page.evaluate((creditsMap) => {
      const subjects: any[] = [];
      const attendance: any[] = [];
      
      const tables = document.querySelectorAll('table.table');
      if (tables.length > 0) {
        const rows = tables[0].querySelectorAll('tbody tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 6) {
            const code = cells[0]?.textContent?.trim() || '';
            const name = cells[1]?.textContent?.trim() || '';
            const maxHoursStr = cells[2]?.textContent?.trim() || '0';
            const attHoursStr = cells[3]?.textContent?.trim() || '0';
            
            // Strictly exclude 'Total', 'AUG / 2026', empty codes, or summary rows
            if (code && !code.toLowerCase().includes('total') && !code.includes('/') && maxHoursStr.match(/^\d+$/)) {
              subjects.push({
                code,
                name,
                credits: creditsMap[code] || 0 // Use actual credits if found
              });
              
              attendance.push({
                subjectCode: code,
                conductedHours: parseInt(maxHoursStr, 10),
                attendedHours: parseInt(attHoursStr, 10)
              });
            }
          }
        });
      }
      return { subjects, attendance };
    }, courseCredits);
  }
}
