import { Component } from '@angular/core';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ServiceInvoiceService } from './service-invoice.service';
import { MainItemServiceInvoice } from './service-invoice.model';
import { ApiService } from '../shared/ApiService.service';
import * as FileSaver from 'file-saver';
import { MainItemExecutionOrder } from '../models/execution-order.model';

@Component({
  selector: 'app-service-invoice',
  templateUrl: './service-invoice.component.html',
  styleUrls: ['./service-invoice.component.css'],
  providers: [MessageService, ServiceInvoiceService, ConfirmationService]
})
export class ServiceInvoiceComponent {

  public rowIndex = 0;
  executionOrders: MainItemExecutionOrder[] = [];
  serviceInvoiceRecords: MainItemServiceInvoice[] = [];
  displayExecutionOrderDialog: boolean = false;
  selectedExecutionOrders: MainItemExecutionOrder[] = [];
  selectedServiceInvoice: MainItemServiceInvoice[] = [];

  lineNumber: string = "";
  executionOrderWithlineNumber?: MainItemExecutionOrder;
  // serviceInvoiceWithlineNumber?: MainItemServiceInvoice;
  savedServiceInvoice?: MainItemServiceInvoice

  searchKey: string = ""
  currency: any
  totalValue: number = 0.0
  // Pagination:
  loading: boolean = true;

  constructor(private _ApiService: ApiService, private _ServiceInvoiceService: ServiceInvoiceService, private messageService: MessageService, private confirmationService: ConfirmationService) { }

  showExecutionOrderDialog() {
    this.displayExecutionOrderDialog = true;
  }
  saveSelection() {
    console.log(this.serviceInvoiceRecords);
    console.log('Selected items:', this.selectedExecutionOrders);
    this.displayExecutionOrderDialog = false;
  }

  searchLineNumber(lineNumber: string) {
    if (lineNumber) {
      this._ApiService.get<MainItemExecutionOrder[]>('executionordermain/linenumber', lineNumber).subscribe(response => {
        this.executionOrderWithlineNumber = response[0]
        console.log(this.executionOrderWithlineNumber);
      });
      // https://sd.c-2754c50.kyma.ondemand.com/serviceinvoice/linenumber?lineNumber=A100
      console.log(lineNumber);
    }
    else {
      this.executionOrderWithlineNumber = undefined
      console.log(this.executionOrderWithlineNumber);
    }
  }

  ngOnInit() {
    console.log(this.selectedServiceInvoice);
    // console.log("lineNumber", this.lineNumber);
    this._ApiService.get<MainItemServiceInvoice[]>('serviceinvoice').subscribe(response => {
      this.serviceInvoiceRecords = response.sort((a, b) => a.serviceInvoiceCode - b.serviceInvoiceCode);
      console.log(this.serviceInvoiceRecords);
      this.loading = false;
      const filteredRecords = this.serviceInvoiceRecords.filter(record => record.lineTypeCode != "Contingency line");
      this.totalValue = filteredRecords.reduce((sum, record) => sum + record.total, 0);
      console.log('Total Value:', this.totalValue);
    });

    this._ApiService.get<MainItemExecutionOrder[]>('executionordermain').subscribe(response => {
      this.executionOrders = response.sort((a, b) => b.executionOrderMainCode - a.executionOrderMainCode);
      console.log(this.executionOrders);
      const filteredRecords = this.executionOrders.filter(record => record.lineTypeCode != "");
      // this.totalValue = this.executionOrders.reduce((sum, record) => sum + record.total, 0);
      // console.log('Total Value:', this.totalValue);
    });
  }

  // to handel checkbox selection:
  selectedMainItems: MainItemServiceInvoice[] = [];

  onMainItemSelection(event: any, mainItem: MainItemServiceInvoice) {

    mainItem.selected = event.checked;
    console.log(event.checked);
    console.log(this.selectedMainItems);

    if (mainItem.selected) {
      this.selectedMainItems.push(mainItem);
      console.log(this.selectedMainItems);
    }
    else {
      const index = this.selectedMainItems.indexOf(mainItem);
      console.log(index);
      if (index !== -1) {
        this.selectedMainItems.splice(index, 1);
        console.log(this.selectedMainItems);
      }

    }
  }
  // to handle All Records Selection / Deselection 
  selectedAllRecords: MainItemServiceInvoice[] = [];
  onSelectAllRecords(event: any): void {
    if (Array.isArray(event.checked) && event.checked.length > 0) {
      this.selectedAllRecords = [...this.serviceInvoiceRecords];
      console.log(this.selectedAllRecords);
    } else {
      this.selectedAllRecords = [];
    }
  }

  // For Edit  ServiceInvoice MainItem:
  clonedMainItem: { [s: number]: MainItemServiceInvoice } = {};
  onMainItemEditInit(record: MainItemServiceInvoice) {
    this.clonedMainItem[record.serviceInvoiceCode] = { ...record };
  }
  onMainItemEditSave(index: number, record: MainItemServiceInvoice) {
    let executionOrderCode: number=0;
    console.log(record);

    if (record.lineNumber) {
      this._ApiService.get<MainItemExecutionOrder[]>('executionordermain/linenumber', record.lineNumber).subscribe(response => {
        executionOrderCode = response[0].executionOrderMainCode
        console.log(executionOrderCode);
      });
    }
    // else {
    //   this.executionOrderWithlineNumber = undefined
    //   console.log(this.executionOrderWithlineNumber);
    // }
    if ((record.quantity + record.actualQuantity) > record.totalQuantity) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: ' Sum of Quantity and ActualQuantity greater than TotalQuantity',
        life: 8000
      });
    }
    else {
      const updatedMainItem = this.removePropertiesFrom(record, ['serviceInvoiceCode']);
      console.log(updatedMainItem);

      // Remove properties with empty or default values
      const filteredRecord = Object.fromEntries(
        Object.entries(updatedMainItem).filter(([_, value]) => {
          return value !== '' && value !== 0 && value !== undefined && value !== null;
        })
      );
      console.log(filteredRecord);

      this._ApiService.patch<MainItemServiceInvoice>('serviceinvoice', record.serviceInvoiceCode, filteredRecord).subscribe({
        next: (res) => {
          console.log('serviceInvoice  updated:', res);
          this.savedServiceInvoice=res;
          this.totalValue = 0;
          this.ngOnInit()
        }, error: (err) => {
          console.log(err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Invalid Data' });
        },
        complete: () => {
          console.log(this.savedServiceInvoice);
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Record updated successfully ' });
          // this.ngOnInit()
          if (executionOrderCode && this.savedServiceInvoice) {
            this._ApiService.patch<MainItemExecutionOrder>('executionordermain', executionOrderCode, { actualQuantity: this.savedServiceInvoice.actualQuantity, actualPercentage: this.savedServiceInvoice.actualPercentage }).subscribe({
              next: (res) => {
                console.log('execution order updated:', res);
                this.ngOnInit()
              }, error: (err) => {
                console.log(err);
              },
              complete: () => {
                this.savedServiceInvoice=undefined;
              }
            });
          }
          //
        }
      });
    }


  }
  onMainItemEditCancel(row: MainItemServiceInvoice, index: number) {
    this.serviceInvoiceRecords[index] = this.clonedMainItem[row.serviceInvoiceCode]
    delete this.clonedMainItem[row.serviceInvoiceCode]
  }
  // Delete ServiceInvoice MainItem 
  deleteRecord() {
    console.log("delete");
    console.log(this.selectedServiceInvoice);

    if (this.selectedServiceInvoice.length) {
      this.confirmationService.confirm({
        message: 'Are you sure you want to delete the selected record?',
        header: 'Confirm',
        icon: 'pi pi-exclamation-triangle',
        accept: () => {
          for (const record of this.selectedServiceInvoice) {
            console.log(record);
            this._ApiService.delete<MainItemServiceInvoice>('serviceinvoice', record.serviceInvoiceCode).subscribe(response => {
              console.log('serviceinvoice deleted :', response);
              this.totalValue = 0;
              this.ngOnInit();
            });
          }
          this.messageService.add({ severity: 'success', summary: 'Successfully', detail: 'Deleted', life: 3000 });
          this.selectedMainItems = []; // Clear the selectedRecords array after deleting all records
        }
      });
    }

  }

  // For Add new  Main Item
  cancelMainItemExecutionOrder(item: any): void {
    this.selectedExecutionOrders = this.selectedExecutionOrders.filter(i => i !== item);
  }

  addMainItem() {

    if (this.executionOrderWithlineNumber) {
      console.log(this.executionOrderWithlineNumber);

      const newRecord = {
        serviceNumberCode: this.executionOrderWithlineNumber.serviceNumberCode,
        description: this.executionOrderWithlineNumber.description,
        unitOfMeasurementCode: this.executionOrderWithlineNumber.unitOfMeasurementCode,
        currencyCode: this.executionOrderWithlineNumber.currencyCode,

        materialGroupCode: this.executionOrderWithlineNumber.materialGroupCode,
        serviceTypeCode: this.executionOrderWithlineNumber.serviceTypeCode,
        personnelNumberCode: this.executionOrderWithlineNumber.personnelNumberCode,
        lineTypeCode: this.executionOrderWithlineNumber.lineTypeCode,

        totalQuantity: this.executionOrderWithlineNumber.totalQuantity,
        // remainingQuantity:,
        quantity: this.executionOrderWithlineNumber.serviceQuantity,

        amountPerUnit: this.executionOrderWithlineNumber.amountPerUnit,
        total: this.executionOrderWithlineNumber.total,

        // actualQuantity: this.newMainItem.actualQuantity,
        // actualPercentage: this.newMainItem.actualPercentage,

        overFulfillmentPercentage: this.executionOrderWithlineNumber.overFulfillmentPercentage,
        unlimitedOverFulfillment: this.executionOrderWithlineNumber.unlimitedOverFulfillment,
        manualPriceEntryAllowed: this.executionOrderWithlineNumber.manualPriceEntryAllowed,
        externalServiceNumber: this.executionOrderWithlineNumber.externalServiceNumber,
        serviceText: this.executionOrderWithlineNumber.serviceText,
        lineText: this.executionOrderWithlineNumber.lineText,
        lineNumber: this.executionOrderWithlineNumber.lineNumber,

        biddersLine: this.executionOrderWithlineNumber.biddersLine,
        supplementaryLine: this.executionOrderWithlineNumber.supplementaryLine,
        lotCostOne: this.executionOrderWithlineNumber.lotCostOne,
        doNotPrint: this.executionOrderWithlineNumber.doNotPrint,
      }
      console.log(newRecord);

      if (this.executionOrderWithlineNumber.serviceQuantity === 0) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: ' Quantity is required',
          life: 8000
        });
      }
      else {
        console.log(newRecord);
        // Remove properties with empty or default values
        const filteredRecord = Object.fromEntries(
          Object.entries(newRecord).filter(([_, value]) => {
            return value !== '' && value !== 0 && value !== undefined && value !== null;
          })
        );
        console.log(filteredRecord);
        this._ApiService.post<MainItemServiceInvoice>('serviceinvoice', filteredRecord).subscribe({
          next: (res) => {
            console.log('serviceInvoice created:', res);
            this.savedServiceInvoice = res;
            this.ngOnInit()
          }, error: (err) => {
            console.log(err);
          },
          complete: () => {
            this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Record added successfully ' });
            //this.ngOnInit()
            console.log(this.savedServiceInvoice);
            //
            if (this.executionOrderWithlineNumber?.executionOrderMainCode && this.savedServiceInvoice) {
              this._ApiService.patch<MainItemExecutionOrder>('executionordermain', this.executionOrderWithlineNumber.executionOrderMainCode, { actualQuantity: this.savedServiceInvoice.actualQuantity, actualPercentage: this.savedServiceInvoice.actualPercentage }).subscribe({
                next: (res) => {
                  console.log('execution order updated:', res);
                  this.ngOnInit()
                }, error: (err) => {
                  console.log(err);
                },
                complete: () => {
                  this.savedServiceInvoice=undefined
                  this.executionOrderWithlineNumber = undefined;
                }
              });
              this.executionOrderWithlineNumber = undefined;
            }
            //
          }
        });
      }
    }
  }
  // for selected execution orders:
  saveMainItem(mainItem: MainItemExecutionOrder) {
    console.log(mainItem);
    const newRecord = {
      serviceNumberCode: mainItem.serviceNumberCode,
      description: mainItem.description,
      unitOfMeasurementCode: mainItem.unitOfMeasurementCode,
      currencyCode: mainItem.currencyCode,

      materialGroupCode: mainItem.materialGroupCode,
      serviceTypeCode: mainItem.serviceTypeCode,
      personnelNumberCode: mainItem.personnelNumberCode,
      lineTypeCode: mainItem.lineTypeCode,

      totalQuantity: mainItem.totalQuantity,
      // remainingQuantity:,
      quantity: mainItem.serviceQuantity,

      amountPerUnit: mainItem.amountPerUnit,
      total: mainItem.total,

      // actualQuantity: this.newMainItem.actualQuantity,
      // actualPercentage: this.newMainItem.actualPercentage,

      overFulfillmentPercentage: mainItem.overFulfillmentPercentage,
      unlimitedOverFulfillment: mainItem.unlimitedOverFulfillment,
      manualPriceEntryAllowed: mainItem.manualPriceEntryAllowed,
      externalServiceNumber: mainItem.externalServiceNumber,
      serviceText: mainItem.serviceText,
      lineText: mainItem.lineText,
      lineNumber: mainItem.lineNumber,

      biddersLine: mainItem.biddersLine,
      supplementaryLine: mainItem.supplementaryLine,
      lotCostOne: mainItem.lotCostOne,
      doNotPrint: mainItem.doNotPrint,
    }
    console.log(newRecord);

    if (mainItem.serviceQuantity === 0) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: ' Quantity is required',
        life: 3000
      });
    }
    else {
      console.log(newRecord);
      // Remove properties with empty or default values
      const filteredRecord = Object.fromEntries(
        Object.entries(newRecord).filter(([_, value]) => {
          return value !== '' && value !== 0 && value !== undefined && value !== null;
        })
      );
      console.log(filteredRecord);
      this._ApiService.post<MainItemServiceInvoice>('serviceinvoice', filteredRecord).subscribe({
        next: (res) => {
          console.log('serviceInvoice created:', res);
          this.savedServiceInvoice=res;
          this.ngOnInit()
        }, error: (err) => {
          console.log(err);
        },
        complete: () => {
          console.log(this.savedServiceInvoice);
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Record added successfully ' });
          //this.ngOnInit()
          if (mainItem.executionOrderMainCode && this.savedServiceInvoice) {
            this._ApiService.patch<MainItemExecutionOrder>('executionordermain', mainItem.executionOrderMainCode, { actualQuantity: this.savedServiceInvoice.actualQuantity, actualPercentage: this.savedServiceInvoice.actualPercentage }).subscribe({
              next: (res) => {
                console.log('execution order updated:', res);
                this.ngOnInit()
              }, error: (err) => {
                console.log(err);
              },
              complete: () => {
                this.savedServiceInvoice=undefined;
              }
            });
            //
            this.selectedExecutionOrders = [];
          }
          //
        }
      });
    }
  }
  //Export  to Excel Sheet
  exportExcel() {
    import('xlsx').then((xlsx) => {
      const selectedRows = this.serviceInvoiceRecords;
      const worksheet = xlsx.utils.json_to_sheet(selectedRows);
      const workbook = { Sheets: { data: worksheet }, SheetNames: ['data'] };
      const excelBuffer: any = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
      this.saveAsExcelFile(excelBuffer, 'Service Invoice');
    });
  }
  saveAsExcelFile(buffer: any, fileName: string): void {
    let EXCEL_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8';
    let EXCEL_EXTENSION = '.xlsx';
    const data: Blob = new Blob([buffer], {
      type: EXCEL_TYPE
    });
    FileSaver.saveAs(data, fileName + '_export_' + new Date().getTime() + EXCEL_EXTENSION);
  }

  // Helper Functions:
  removePropertiesFrom(obj: any, propertiesToRemove: string[]): any {
    const newObj: any = {};
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (Array.isArray(obj[key])) {
          // If the property is an array, recursively remove properties from each element
          newObj[key] = obj[key].map((item: any) => this.removeProperties(item, propertiesToRemove));
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          // If the property is an object, recursively remove properties from the object
          newObj[key] = this.removeProperties(obj[key], propertiesToRemove);
        } else if (!propertiesToRemove.includes(key)) {
          // Otherwise, copy the property if it's not in the list to remove
          newObj[key] = obj[key];
        }
      }
    }

    return newObj;
  }
  removeProperties(obj: any, propertiesToRemove: string[]): any {
    const newObj: any = {};
    Object.keys(obj).forEach(key => {
      if (!propertiesToRemove.includes(key)) {
        newObj[key] = obj[key];
      }
    });
    return newObj;
  }

  newMainItem: MainItemServiceInvoice = {
    serviceInvoiceCode: 0,
    executionOrderMainCode: 0,
    serviceNumberCode: 0,
    description: "",
    unitOfMeasurementCode: "",
    currencyCode: "",
    materialGroupCode: "",
    serviceTypeCode: "",
    personnelNumberCode: "",
    lineTypeCode: "",

    totalQuantity: 0,
    amountPerUnit: 0,
    total: 0,
    actualQuantity: 0,
    actualPercentage: 0,
    overFulfillmentPercentage: 0,
    unlimitedOverFulfillment: false,
    manualPriceEntryAllowed: false,
    externalServiceNumber: "",
    serviceText: "",
    lineText: "",
    lineNumber: "",

    biddersLine: false,
    supplementaryLine: false,
    lotCostOne: false,
    doNotPrint: false,
    quantity: 0
  };
  resetNewMainItem() {
    this.newMainItem = {
      serviceInvoiceCode: 0,
      executionOrderMainCode: 0,
      serviceNumberCode: 0,
      description: "",
      unitOfMeasurementCode: "",
      currencyCode: "",
      materialGroupCode: "",
      serviceTypeCode: "",
      personnelNumberCode: "",
      lineTypeCode: "",

      totalQuantity: 0,
      amountPerUnit: 0,
      total: 0,
      actualQuantity: 0,
      actualPercentage: 0,
      overFulfillmentPercentage: 0,
      unlimitedOverFulfillment: false,
      manualPriceEntryAllowed: false,
      externalServiceNumber: "",
      serviceText: "",
      lineText: "",
      lineNumber: "",

      biddersLine: false,
      supplementaryLine: false,
      lotCostOne: false,
      doNotPrint: false,
      quantity: 0,
    }
  }

}
