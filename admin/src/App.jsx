import { useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import "./App.css";

const API = "https://sheliva-server.onrender.com";
const SIZES = ["36","37","38","39","40","41"];

const n = v => Number(v || 0);

const money = value =>
  n(value).toLocaleString("tr-TR", {
    style:"currency",
    currency:"TRY"
  });

function totalStock(product) {
  return (product.colors || []).reduce(
    (sum,color) =>
      sum +
      Object.values(color.sizes || {})
        .reduce(
          (s,v) => s + n(v),
          0
        ),
    0
  );
}

function emptyColor(index=1) {
  return {
    id:`CLR-${Date.now()}-${index}`,
    name:"",
    images:[],
    sizes:Object.fromEntries(
      SIZES.map(size => [size,0])
    )
  };
}

function emptyProduct() {
  return {
    name:"",
    category:"Yazlık",
    description:"",
    quality:"",
    sole:"",
    features:"",
    measurements:"",
    paymentInfo:"",
    shippingReturns:"",
    faq:"",

    price:0,
    discount:15,

    purchasePrice:0,
    vatRate:20,
    shippingCost:0,
    packagingCost:0,
    otherCost:0,

    active:true,
    newest:true,
    featured:false,

    colors:[emptyColor(1)]
  };
}

function calculate(product) {
  const list = n(product.price);
  const discount =
    Math.max(
      0,
      Math.min(100,n(product.discount))
    );

  const sale =
    list * (1 - discount / 100);

  const vat =
    n(product.purchasePrice) *
    n(product.vatRate) /
    100;

  const totalCost =
    n(product.purchasePrice) +
    vat +
    n(product.shippingCost) +
    n(product.packagingCost) +
    n(product.otherCost);

  return {
    sale,
    vat,
    totalCost,
    profit:sale-totalCost
  };
}

export default function App() {
  const [tickets,setTickets] = useState([]);
  const [returns,setReturns] = useState([]);
  const [settings,setSettings] = useState({});
  const [metrics,setMetrics] = useState({});
  const settingsDirtyRef = useRef(false);
  const [page,setPage] =
    useState("dashboard");

  const [products,setProducts] =
    useState([]);

  const [orders,setOrders] =
    useState([]);

  const [reviews,setReviews] =
    useState([]);

  const [connected,setConnected] =
    useState(false);

  const [orderTab,setOrderTab] =
    useState("Yeni");

  const [editing,setEditing] =
    useState(null);

  const [modalOpen,setModalOpen] =
    useState(false);

  const [activeColorIndex,setActiveColorIndex] =
    useState(0);

  const [selectedOrder,setSelectedOrder] =
    useState(null);

  const [cargoDraft,setCargoDraft] =
    useState({
      company:"Aras Kargo",
      tracking:"",
      note:""
    });

  async function refresh() {
    try {
      const [p,o,r] =
        await Promise.all([
          fetch(`${API}/api/products`),
          fetch(`${API}/api/orders`),
          fetch(`${API}/api/reviews`)
        ]);

      if (!p.ok || !o.ok || !r.ok) {
        throw new Error();
      }

      setProducts(await p.json());
      setOrders(await o.json());
      setReviews(await r.json());

      try {
        const [tt,rr,ss,mm]=await Promise.all([fetch(`${API}/api/tickets`),fetch(`${API}/api/returns`),fetch(`${API}/api/settings`),fetch(`${API}/api/metrics`)]);
        if(tt.ok)setTickets(await tt.json()); if(rr.ok)setReturns(await rr.json()); if(ss.ok){const incoming=await ss.json(); if(!settingsDirtyRef.current)setSettings(incoming);} if(mm.ok)setMetrics(await mm.json());
      } catch {}
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }

  useEffect(()=>{
    refresh();

    const timer =
      setInterval(refresh,2000);

    return () =>
      clearInterval(timer);
  },[]);

  const activeOrders =
    orders.filter(
      o =>
        ![
          "Teslim Edildi",
          "İptal"
        ].includes(o.status)
    );

  const newOrders =
    orders.filter(
      o => o.status==="Yeni"
    );

  const revenue =
    orders
      .filter(
        o => o.status!=="İptal"
      )
      .reduce(
        (s,o) => s+n(o.total),
        0
      );

  const completedSales =
    orders
      .filter(
        o => o.status==="Teslim Edildi"
      )
      .reduce(
        (s,o) => s+n(o.total),
        0
      );

  const urgentOrders =
    orders.filter(order => {
      if (
        [
          "Teslim Edildi",
          "Kargoya Verildi",
          "İptal"
        ].includes(order.status)
      ) {
        return false;
      }

      return (
        Date.now() -
        new Date(order.createdAt).getTime()
      ) >= 3*86400000;
    });

  const filteredOrders =
    useMemo(
      () =>
        orders.filter(
          o => o.status===orderTab
        ),
      [orders,orderTab]
    );

  function openNewProduct() {
    setEditing(emptyProduct());
    setActiveColorIndex(0);
    setModalOpen(true);
  }

  function openEditProduct(product) {
    const clone =
      JSON.parse(
        JSON.stringify(product)
      );

    clone.colors =
      (clone.colors || []).map(
        color => ({
          ...color,
          images:
            color.images?.length
              ? color.images
              : color.image
                ? [color.image]
                : []
        })
      );

    setEditing(clone);
    setActiveColorIndex(0);
    setModalOpen(true);
  }

  async function saveProduct(event) {
    event.preventDefault();

    if (!editing?.name?.trim()) {
      return alert("Ürün adı gerekli.");
    }

    if (!editing.colors?.length) {
      return alert("En az 1 renk gerekli.");
    }

    if (
      editing.colors.some(
        c => !c.name?.trim()
      )
    ) {
      return alert("Renk adı boş olamaz.");
    }

    const exists =
      products.some(
        p =>
          Number(p.id) ===
          Number(editing.id)
      );

    const url =
      exists
        ? `${API}/api/products/${editing.id}`
        : `${API}/api/products`;

    const res =
      await fetch(url,{
        method:
          exists
            ? "PUT"
            : "POST",

        headers:{
          "Content-Type":"application/json"
        },

        body:
          JSON.stringify(editing)
      });

    const data =
      await res.json();

    if (!res.ok) {
      return alert(
        data.error ||
        "Ürün kaydedilemedi."
      );
    }

    setModalOpen(false);
    setEditing(null);

    await refresh();
  }

  async function deleteProduct(product) {
    if (
      !confirm(
        `${product.name} silinsin mi?`
      )
    ) {
      return;
    }

    await fetch(
      `${API}/api/products/${product.id}`,
      {method:"DELETE"}
    );

    await refresh();
  }

  async function changeOrderStatus(
    order,
    status,
    extra={}
  ) {
    // ODEME_ONAY_ADMIN_V1
    if(status==="Hazırlanıyor" && order.paymentStatus!=="Ödendi"){
      const paymentApproved = window.confirm(
        `${order.orderNo} için ödemeyi aldığını onaylıyor musun?\n\n` +
        "Onayladığında stok düşecek ve sipariş hazırlanıyor durumuna geçecek."
      );

      if(!paymentApproved) return;

      const paymentRes = await fetch(
        `${API}/api/orders/${order.id}/approve-payment`,
        {method:"POST"}
      );

      const paymentData = await paymentRes.json();

      if(!paymentRes.ok){
        return alert(paymentData.error || "Ödeme onaylanamadı.");
      }

      setSelectedOrder(null);
      alert("Ödeme onaylandı. Sipariş hazırlanıyor.");
      await refresh();
      return;
    }
    const messages = {
      "Hazırlanıyor":`${order.orderNo} siparişi HAZIRLAMAYA alınacak. Onaylıyor musun?`,
      "Kargoya Verildi":`${order.orderNo} siparişi KARGOYA VERİLDİ olarak işaretlenecek. Onaylıyor musun?`,
      "Teslim Edildi":`${order.orderNo} siparişi TESLİM EDİLDİ olarak işaretlenecek. Onaylıyor musun?`,
      "İptal":`${order.orderNo} siparişi iptal edilecek. Onaylıyor musun?`
    };

    if(!window.confirm(messages[status] || `${order.orderNo} sipariş durumu değiştirilecek. Onaylıyor musun?`)){
      return;
    }

    const res =
      await fetch(
        `${API}/api/orders/${order.id}/status`,
        {
          method:"PUT",

          headers:{
            "Content-Type":"application/json"
          },

          body:
            JSON.stringify({
              status,
              ...extra
            })
        }
      );

    if (!res.ok) {
      return alert(
        "Sipariş güncellenemedi."
      );
    }

    setSelectedOrder(null);
    await refresh();
  }

  async function revertOrder(order) {
    if(!window.confirm(`${order.orderNo} bir önceki duruma geri alınacak. Onaylıyor musun?`)) return;

    const res = await fetch(`${API}/api/orders/${order.id}/revert`,{method:"POST"});
    const data = await res.json();

    if(!res.ok){
      return alert(data.error || "Sipariş geri alınamadı.");
    }

    setSelectedOrder(null);
    await refresh();
  }

  async function setReviewStatus(review,status) {
    const res = await fetch(`${API}/api/reviews/${review.id}`,{
      method:"PUT",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({status})
    });
    if(!res.ok) return alert("Yorum güncellenemedi.");
    await refresh();
  }

  async function deleteReview(review) {
    if(!window.confirm("Bu yorum kalıcı olarak silinsin mi?")) return;
    const res=await fetch(`${API}/api/reviews/${review.id}`,{method:"DELETE"});
    if(!res.ok) return alert("Yorum silinemedi.");
    setReviews(current=>current.filter(item=>item.id!==review.id));
    await refresh();
  }

  async function setReturnStatus(item,status) {
    const res = await fetch(`${API}/api/returns/${item.id}`,{
      method:"PUT",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({status})
    });
    if(!res.ok) return alert("İade güncellenemedi.");
    await refresh();
  }

  async function saveSettings() {
    const res = await fetch(`${API}/api/settings`,{
      method:"PUT",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(settings)
    });
    if(!res.ok) return alert("Ayarlar kaydedilemedi.");
    settingsDirtyRef.current=false;
    alert("Ayarlar kaydedildi.");
    await refresh();
  }

  return (
    <div className="app">

      <aside className="sidebar">

        <div className="logo">
          SHELİVA
          <small>
            YÖNETİM PANELİ
          </small>
        </div>

        <nav>

          <Menu
            active={page==="dashboard"}
            label="Genel Bakış"
            icon="⌂"
            onClick={()=>setPage("dashboard")}
          />

          <Menu
            active={page==="orders"}
            label="Siparişler"
            icon="▣"
            badge={newOrders.length}
            onClick={()=>setPage("orders")}
          />

          <Menu
            active={page==="products"}
            label="Ürünler"
            icon="◇"
            onClick={()=>setPage("products")}
          />

          <Menu
            active={page==="stock"}
            label="Stok"
            icon="▤"
            onClick={()=>setPage("stock")}
          />

          <Menu
            active={page==="shipping"}
            label="Kargolar"
            icon="▰"
            onClick={()=>setPage("shipping")}
          />

          <Menu
            active={page==="customers"}
            label="Müşteriler"
            icon="♙"
            onClick={()=>setPage("customers")}
          />

          <Menu
            active={page==="reviews"}
            label="Yorumlar"
            icon="★"
            badge={
              reviews.filter(
                r => r.status==="Bekliyor"
              ).length
            }
            onClick={()=>setPage("reviews")}
          />

          <Menu
            active={page==="returns"}
            label="İadeler"
            icon="↩"
            onClick={()=>setPage("returns")}
          />

          <Menu
            active={page==="reports"}
            label="Raporlar"
            icon="⌁"
            onClick={()=>setPage("reports")}
          />

          <Menu
            active={page==="settings"}
            label="Ayarlar"
            icon="⚙"
            onClick={()=>setPage("settings")}
          />

        </nav>

      </aside>

      <main>

        <header className="topbar">

          <div>
            <small>SHELİVA</small>

            <h1>
              {{
                dashboard:"Genel Bakış",
                orders:"Siparişler",
                products:"Ürünler",
                stock:"Stok Yönetimi",
                shipping:"Kargolar",tickets:"Üretim Fişleri",media:"Medya",
                customers:"Müşteriler",
                reviews:"Yorumlar",
                returns:"İadeler",
                reports:"Raporlar",
                settings:"Ayarlar"
              }[page]}
            </h1>
          </div>

          <div
            className={
              connected
                ? "server connected"
                : "server"
            }
          >
            <i></i>

            {connected
              ? "SERVER BAĞLI"
              : "SERVER BAĞLANTISI YOK"}
          </div>

        </header>

        {page==="dashboard" && (
          <>
            <section className="stats">

              <Stat
                label="Toplam Model Sayısı"
                value={products.length}
                icon="◇"
              />

              <Stat
                label="Toplam Ürün Adeti"
                value={
                  products.reduce(
                    (s,p) =>
                      s+totalStock(p),
                    0
                  )
                }
                icon="▣"
              />

              <Stat
                label="Toplam Aktif Siparişler"
                value={activeOrders.length}
                icon="▤"
              />

            </section>

          <section className="finance">

              <div className="financeCard revenue">
                <span>Toplam Ciro</span>
                <strong>
                  {money(revenue)}
                </strong>
              </div>

              <div className="financeCard sales netProfitCard">
                <span>Toplam Net Kâr</span>
                <strong>
                  {money(metrics.netProfit || 0)}
                </strong>
              </div>

            </section>

            <section className="dashboardBottom">

              <div className="newOrdersCard">

                <div className="cardTitle">
                  <div>
                    <h2>Yeni Siparişler</h2>
                    <p>Onay bekleyen siparişler</p>
                  </div>

                  <button
                    onClick={()=>{
                      setOrderTab("Yeni");
                      setPage("orders");
                    }}
                  >
                    Tümünü Gör →
                  </button>
                </div>

                {!newOrders.length ? (
                  <div className="noOrders">
                    Yeni sipariş yok.
                  </div>
                ) : (
                  newOrders
                    .slice(0,5)
                    .map(order => (
                      <div
                        className="dashboardOrder"
                        key={order.id}
                        onClick={()=>
                          setSelectedOrder(order)
                        }
                      >
                        <b>{order.orderNo}</b>
                        <span>{order.customer.name}</span>
                        <span>{order.items?.[0]?.name}</span>
                        <strong>{money(order.total)}</strong>
                      </div>
                    ))
                )}

              </div>

              <div className="urgentCard">

                <div className="urgentTitle">
                  <div>
                    <h2>
                      ⚠ Acil Kargoya Verilecekler
                    </h2>
                    <p>3 günü geçenler</p>
                  </div>

                  <b>
                    {urgentOrders.length}
                  </b>
                </div>

                {!urgentOrders.length ? (
                  <div className="urgentEmpty">
                    Acil sipariş yok.
                  </div>
                ) : (
                  urgentOrders.map(
                    order => (
                      <div
                        className="urgentItem"
                        key={order.id}
                        onClick={()=>
                          setSelectedOrder(order)
                        }
                      >
                        <div>
                          <b>{order.orderNo}</b>
                          <span>{order.customer.name}</span>
                        </div>

                        <strong>ACİL</strong>
                      </div>
                    )
                  )
                )}

              </div>

            </section>
          </>
        )}

        {page==="orders" && (
          <section className="pageCard">

            <div className="orderTabs">

              {[
                "Yeni",
                "Hazırlanıyor",
                "Kargoya Verildi",
                "Teslim Edildi"
              ].map(status => (
                <button
                  key={status}
                  className={
                    orderTab===status
                      ? "active"
                      : ""
                  }
                  onClick={()=>
                    setOrderTab(status)
                  }
                >
                  {status}

                  <b>
                    {
                      orders.filter(
                        o =>
                          o.status===status
                      ).length
                    }
                  </b>
                </button>
              ))}

            </div>

            <div className="orderCards">

              {filteredOrders.map(
                order => (
                  <article
                    className="orderCard"
                    key={order.id}
                  >

                    <div className="orderTop">
                      <div>
                        <small>SİPARİŞ</small>
                        <h3>{order.orderNo}</h3>
                      </div>

                      <em>{order.status}</em>
                    </div>

                    <div className="orderInfo">

                      <label>
                        Müşteri
                        <b>{order.customer.name}</b>
                      </label>

                      <label>
                        Kaynak
                        <b>
                          {order.source || "SHELIVA Web"}
                        </b>
                      </label>

                    </div>

                    <div className="orderedProducts">

                      {(order.items||[])
                        .map(item => (
                          <div key={item.key}>
                            <span>{item.name}</span>
                            <small>
                              {item.colorName}
                              {" • "}
                              {item.size}
                              {" • "}
                              {item.qty} adet
                            </small>
                          </div>
                        ))}

                    </div>

                    <div className="orderBottom">
                      <strong>
                        {money(order.total)}
                      </strong>

                      <button
                        onClick={()=>
                          setSelectedOrder(order)
                        }
                      >
                        DETAY
                      </button>
                    </div>

                  </article>
                )
              )}

              {!filteredOrders.length && (
                <div className="emptyPage">
                  Bu durumda sipariş yok.
                </div>
              )}

            </div>

          </section>
        )}

        {page==="products" && (
          <section className="pageCard">

            <div className="pageTitle">

              <div>
                <h2>Ürünler</h2>
                <p>
                  Detaylı ürün, maliyet,
                  varyant ve fotoğraf yönetimi.
                </p>
              </div>

              <button onClick={openNewProduct}>
                + YENİ ÜRÜN
              </button>

            </div>

            <div className="productManagerGrid">

              {products.map(
                product => (
                  <article
                    className="managerProduct"
                    key={product.id}
                  >

                    <div className="managerImage">

                      {product.image ? (
                        <img
                          src={
                            product.image.startsWith("/uploads/")
                              ? API+product.image
                              : product.image
                          }
                        />
                      ) : (
                        <span>
                          FOTOĞRAF YOK
                        </span>
                      )}

                    </div>

                    <div className="managerInfo">

                      <small>
                        {product.code}
                      </small>

                      <h3>
                        {product.name}
                      </h3>

                      <p>
                        {product.category}
                        {" • "}
                        {totalStock(product)} stok
                      </p>

                      <div className="pricePair">
                        {n(product.discount)>0 && (
                          <del>
                            {money(product.price)}
                          </del>
                        )}

                        <strong>
                          {money(
                            product.salePrice ??
                            product.price
                          )}
                        </strong>
                      </div>

                      <div className="miniCost">
                        <span>
                          Maliyet {money(product.totalCost)}
                        </span>

                        <span>
                          Brüt fark {money(product.grossProfit)}
                        </span>
                      </div>

                      <div className="managerActions">

                        <button
                          onClick={()=>
                            openEditProduct(product)
                          }
                        >
                          DÜZENLE
                        </button>

                        <button
                          className="danger"
                          onClick={()=>
                            deleteProduct(product)
                          }
                        >
                          SİL
                        </button>

                      </div>

                    </div>

                  </article>
                )
              )}

            </div>

          </section>
        )}

        {page==="stock" && (
          <section className="pageCard">

            <div className="pageTitle">
              <div>
                <h2>Stok Yönetimi</h2>
                <p>Renk + numara bazında stok.</p>
              </div>
            </div>

            {products.map(
              product => (
                <div
                  className="stockProductCard"
                  key={product.id}
                >

                  <div className="stockProductTitle stockProductTitlePro">
                    <div className="stockMainIdentity">
                      <div className="stockMainPhoto">
                        {(product.colors?.[0]?.images?.[0] || product.colors?.[0]?.image || product.image) ? (
                          <img
                            src={
                              (product.colors?.[0]?.images?.[0] || product.colors?.[0]?.image || product.image).startsWith("/uploads/")
                                ? API+(product.colors?.[0]?.images?.[0] || product.colors?.[0]?.image || product.image)
                                : (product.colors?.[0]?.images?.[0] || product.colors?.[0]?.image || product.image)
                            }
                          />
                        ) : (
                          <span>FOTOĞRAF YOK</span>
                        )}
                      </div>

                      <div>
                        <h3>{product.name}</h3>
                        <span>{product.code}</span>
                        <small>{product.quality || "Kalite girilmedi"} • {product.sole || "Taban girilmedi"}</small>
                      </div>
                    </div>

                    <div className="stockTotalBadge">
                      <span>TOPLAM STOK</span>
                      <strong>{totalStock(product)} adet</strong>
                    </div>
                  </div>

                  {(product.colors||[])
                    .map(color => (
                      <div
                        className="stockColor stockColorPro"
                        key={color.id}
                      >
                        <div className="stockColorIdentity">
                          <div className="stockColorPhoto">
                            {(color.images?.[0] || color.image) ? (
                              <img
                                src={
                                  (color.images?.[0] || color.image).startsWith("/uploads/")
                                    ? API+(color.images?.[0] || color.image)
                                    : (color.images?.[0] || color.image)
                                }
                              />
                            ) : (
                              <span>RENK</span>
                            )}
                          </div>
                          <div>
                            <small>RENK</small>
                            <b>{color.name}</b>
                          </div>
                        </div>

                        <div className="stockSizes">
                          {SIZES.map(size => (
                            <div
                              className="stockSize"
                              key={size}
                            >
                              <span>{size}</span>
                              <strong>
                                {n(color.sizes?.[size])}
                              </strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                  <button
                    className="editStock"
                    onClick={()=>
                      openEditProduct(product)
                    }
                  >
                    STOK DÜZENLE
                  </button>

                </div>
              )
            )}

          </section>
        )}

        {page==="shipping" && (
          <section className="pageCard">

            <div className="pageTitle">
              <div>
                <h2>Kargolar</h2>
                <p>
                  Hazırlanan ve kargoya çıkan siparişler.
                </p>
              </div>
            </div>

            <div className="shippingGrid">

              {orders
                .filter(
                  o =>
                    [
                      "Hazırlanıyor",
                      "Kargoya Verildi"
                    ].includes(o.status)
                )
                .map(order => (
                  <article
                    className="shippingCard"
                    key={order.id}
                    onClick={()=>
                      setSelectedOrder(order)
                    }
                  >
                    <div>
                      <small>{order.orderNo}</small>
                      <h3>{order.customer.name}</h3>
                      <p>
                        {order.customer.city}
                        {" / "}
                        {order.customer.district}
                      </p>
                    </div>

                    <div>
                      <b>{order.status}</b>
                      <span>
                        {order.cargoCompany || "Kargo seçilmedi"}
                      </span>
                      <span>
                        {order.cargoTracking || "Takip kodu yok"}
                      </span>
                    </div>
                  </article>
                ))}

            </div>

          </section>
        )}

        {page==="customers" && (
          <section className="pageCard">

            <div className="pageTitle">
              <div>
                <h2>Müşteriler</h2>
                <p>
                  Siparişlerden oluşan müşteri listesi.
                </p>
              </div>
            </div>

            <div className="customerTable">

              {Array.from(
                new Map(
                  orders.map(
                    o => [
                      o.customer.phone,
                      o.customer
                    ]
                  )
                ).values()
              ).map((customer,index) => (
                <div
                  className="customerRow"
                  key={index}
                >
                  <b>{customer.name}</b>
                  <span>{customer.phone}</span>
                  <span>{customer.email}</span>
                  <span>
                    {customer.city}
                    {" / "}
                    {customer.district}
                  </span>
                </div>
              ))}

            </div>

          </section>
        )}

        {page==="reviews" && (
          <section className="pageCard">
            <div className="pageTitle">
              <div><h2>Yorum Yönetimi</h2><p>Müşteri yorumlarını yayınlanmadan önce kontrol et.</p></div>
              <b className="pageCounter">{reviews.filter(r=>r.status==="Bekliyor").length} bekliyor</b>
            </div>

            <div className="managementList">
              {!reviews.length && <div className="emptyPage">Henüz yorum yok.</div>}
              {reviews.map(review=>(
                <article className="managementRow" key={review.id}>
                  <div className="managementMain">
                    <div className="reviewStars">{"★".repeat(Math.max(1,Math.min(5,n(review.rating))))}</div>
                    <h3>{review.userName || "Müşteri"}</h3>
                    <p>{review.text}</p>
                    <small>{review.createdAt ? new Date(review.createdAt).toLocaleString("tr-TR") : "-"}</small>
                  </div>
                  <div className="managementActions">
                    <b className={review.status==="Onaylandı" ? "statusGreen" : "statusYellow"}>{review.status || "Bekliyor"}</b>
                    {review.status!=="Onaylandı" && <button className="approveButton" onClick={()=>setReviewStatus(review,"Onaylandı")}>ONAYLA</button>}
                    <button className="rejectButton" onClick={()=>deleteReview(review)}>SİL</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {page==="returns" && (
          <section className="pageCard">
            <div className="pageTitle">
              <div><h2>İade Yönetimi</h2><p>İade taleplerini takip et ve durumlarını yönet.</p></div>
              <b className="pageCounter">{returns.length} talep</b>
            </div>

            <div className="managementList">
              {!returns.length && <div className="emptyPage">İade talebi yok.</div>}
              {returns.map(item=>(
                <article className="managementRow returnRow" key={item.id}>
                  <div className="managementMain">
                    <small>{item.orderNo}</small>
                    <h3>{item.customerName || "Müşteri"}</h3>
                    <p>{item.reason || "Sebep belirtilmedi."}</p>
                    <span>{item.createdAt ? new Date(item.createdAt).toLocaleString("tr-TR") : "-"}</span>
                  </div>
                  <div className="managementActions">
                    <select value={item.status || "Talep"} onChange={e=>setReturnStatus(item,e.target.value)}>
                      <option>Talep</option><option>Onaylandı</option><option>Ürün Bekleniyor</option><option>Tamamlandı</option><option>Reddedildi</option>
                    </select>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {page==="reports" && (
          <section className="pageCard">
            <div className="pageTitle"><div><h2>Satış Raporları</h2><p>Satış, stok, kârlılık ve müşteri hareketleri.</p></div></div>

            <div className="reportCards">
              <div><span>Toplam Ciro</span><strong>{money(metrics.grossRevenue || 0)}</strong></div>
              <div className="profitReport"><span>Toplam Net Kâr</span><strong>{money(metrics.netProfit || 0)}</strong></div>
              <div><span>Teslim Edilen</span><strong>{metrics.deliveredCount || 0}</strong></div>
              <div><span>Satılan Çift</span><strong>{metrics.unitsSold || 0}</strong></div>
              <div><span>Ortalama Sepet</span><strong>{money(metrics.averageOrder || 0)}</strong></div>
              <div><span>İade Talebi</span><strong>{metrics.returnCount || 0}</strong></div>
              <div><span>İade Oranı</span><strong>%{n(metrics.returnRate).toFixed(1)}</strong></div>
              <div><span>Aktif Sipariş</span><strong>{metrics.activeOrders || 0}</strong></div>
            </div>

            <div className="reportRanks">
              <ReportRank title="En Çok Satan Modeller" data={metrics.topModels}/>
              <ReportRank title="En Çok Satan Renkler" data={metrics.topColors}/>
              <ReportRank title="En Çok Satan Numaralar" data={metrics.topSizes}/>
            </div>
          </section>
        )}

        {page==="settings" && (
          <section className="pageCard">
            <div className="pageTitle">
              <div><h2>SHELİVA Ayarları</h2><p>Mağaza ve sipariş ayarlarını tek yerden yönet.</p></div>
              <button onClick={saveSettings}>AYARLARI KAYDET</button>
            </div>

            <div className="settingsGrid">
              <label>Mağaza Adı<input value={settings.storeName || ""} onChange={e=>{settingsDirtyRef.current=true;setSettings({...settings,storeName:e.target.value})}}/></label>
              <label>Destek Telefonu<input value={settings.supportPhone || ""} onChange={e=>{settingsDirtyRef.current=true;setSettings({...settings,supportPhone:e.target.value})}}/></label>
              <label>Destek E-posta<input value={settings.supportEmail || ""} onChange={e=>{settingsDirtyRef.current=true;setSettings({...settings,supportEmail:e.target.value})}}/></label>
              <label>Varsayılan KDV %<input type="number" value={settings.defaultVatRate ?? ""} onChange={e=>{settingsDirtyRef.current=true;setSettings({...settings,defaultVatRate:e.target.value})}}/></label>
              <label>Kargo Ücreti<input type="number" value={settings.cargoFee ?? ""} onChange={e=>{settingsDirtyRef.current=true;setSettings({...settings,cargoFee:e.target.value})}}/></label>
              <label>Ücretsiz Kargo Limiti<input type="number" value={settings.freeShippingThreshold ?? ""} onChange={e=>{settingsDirtyRef.current=true;setSettings({...settings,freeShippingThreshold:e.target.value})}}/></label>
              <label>Sipariş Ön Eki<input value={settings.orderPrefix || "SH"} onChange={e=>{settingsDirtyRef.current=true;setSettings({...settings,orderPrefix:e.target.value})}}/></label>
              <label>Üretim Fişi Ön Eki<input value={settings.ticketPrefix || "FIS"} onChange={e=>{settingsDirtyRef.current=true;setSettings({...settings,ticketPrefix:e.target.value})}}/></label>
              <label>Varsayılan Kargo<input value={settings.defaultCargoCompany || "Aras Kargo"} onChange={e=>{settingsDirtyRef.current=true;setSettings({...settings,defaultCargoCompany:e.target.value})}}/></label>
              <label>Banka Adı<input value={settings.bankName || ""} onChange={e=>{settingsDirtyRef.current=true;setSettings({...settings,bankName:e.target.value})}}/></label>
              <label>IBAN<input value={settings.iban || ""} onChange={e=>{settingsDirtyRef.current=true;setSettings({...settings,iban:e.target.value})}}/></label>
              <label>Hesap Sahibi<input value={settings.accountHolder || ""} onChange={e=>{settingsDirtyRef.current=true;setSettings({...settings,accountHolder:e.target.value})}}/></label>
              <label>Instagram kullanici adi veya linki<input placeholder="sheliva veya https://instagram.com/sheliva" value={settings.instagramUrl || ""} onChange={e=>{settingsDirtyRef.current=true;setSettings({...settings,instagramUrl:e.target.value})}}/></label>
              <label>YouTube Linki<input value={settings.youtubeUrl || ""} onChange={e=>{settingsDirtyRef.current=true;setSettings({...settings,youtubeUrl:e.target.value})}}/></label>
              <label>TikTok Linki<input value={settings.tiktokUrl || ""} onChange={e=>{settingsDirtyRef.current=true;setSettings({...settings,tiktokUrl:e.target.value})}}/></label>
              <label>WhatsApp numarasi<input placeholder="905xxxxxxxxx" value={settings.whatsappUrl || ""} onChange={e=>{settingsDirtyRef.current=true;setSettings({...settings,whatsappUrl:e.target.value})}}/></label>
            </div>
          </section>
        )}

      </main>

      {modalOpen && editing && (
        <ProductModal
          product={editing}
          setProduct={setEditing}
          activeColorIndex={activeColorIndex}
          setActiveColorIndex={setActiveColorIndex}
          save={saveProduct}
          close={()=>{
            setModalOpen(false);
            setEditing(null);
          }}
        />
      )}

      {selectedOrder && (
        <OrderModal
          order={selectedOrder}
          close={()=>
            setSelectedOrder(null)
          }
          cargoDraft={cargoDraft}
          setCargoDraft={setCargoDraft}
          changeStatus={changeOrderStatus}
          revertOrder={revertOrder}
        />
      )}

    </div>
  );
}

function Menu({
  active,
  label,
  icon,
  badge,
  onClick
}) {
  return (
    <button
      className={
        active ? "active" : ""
      }
      onClick={onClick}
    >
      <span>{icon}</span>
      <span>{label}</span>

      {!!badge && (
        <b className="navBadge">
          {badge}
        </b>
      )}
    </button>
  );
}

function Stat({
  label,
  value,
  icon
}) {
  return (
    <div className="statCard">
      <div className="statIcon">
        {icon}
      </div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function ProductModal({
  product,
  setProduct,
  activeColorIndex,
  setActiveColorIndex,
  save,
  close
}) {
  const sizeRefs =
    useRef([]);

  const calculated =
    calculate(product);

  const color =
    product.colors?.[activeColorIndex];

  function addColor() {
    const next =
      [
        ...(product.colors||[]),
        emptyColor(
          (product.colors?.length||0)+1
        )
      ];

    setProduct({
      ...product,
      colors:next
    });

    setActiveColorIndex(
      next.length-1
    );
  }

  function updateColor(index,patch) {
    const colors =
      [...product.colors];

    colors[index] = {
      ...colors[index],
      ...patch
    };

    setProduct({
      ...product,
      colors
    });
  }

  function removeColor(index) {
    if (product.colors.length<=1) {
      return;
    }

    const colors =
      product.colors.filter(
        (_,i) => i!==index
      );

    setProduct({
      ...product,
      colors
    });

    setActiveColorIndex(
      Math.max(0,index-1)
    );
  }

  function chooseImages(event,index) {
    const files =
      Array.from(
        event.target.files || []
      );

    if (!files.length) {
      return;
    }

    Promise.all(
      files.map(
        file =>
          new Promise(resolve => {
            const reader =
              new FileReader();

            reader.onload =
              () =>
                resolve({
                  data:reader.result,
                  name:file.name
                });

            reader.readAsDataURL(file);
          })
      )
    ).then(newImages => {
      updateColor(
        index,
        {
          images:[
            ...(product.colors[index].images||[]),
            ...newImages
          ]
        }
      );
    });
  }

  function removeImage(index,imageIndex) {
    const images =
      [...(product.colors[index].images||[])];

    images.splice(
      imageIndex,
      1
    );

    updateColor(
      index,
      {images}
    );
  }

  function handleStockKey(
    event,
    index
  ) {
    if (
      event.key===" " ||
      event.key==="Enter"
    ) {
      event.preventDefault();

      const next =
        sizeRefs.current[index+1];

      if (next) {
        next.focus();
        next.select();
      }
    }
  }

  return (
    <div
      className="modalShade"
      onMouseDown={e=>{
        if(e.target===e.currentTarget) close();
      }}
    >

      <form
        onMouseDown={e=>e.stopPropagation()}
        className="productModal"
        onSubmit={save}
      >

        <div className="modalHeader">
          <div>
            <small>SHELİVA V3</small>
            <h2>
              {product.id
                ? "Ürün Düzenle"
                : "Yeni Ürün"}
            </h2>
          </div>

          <button
            type="button"
            onClick={close}
          >
            ×
          </button>
        </div>

        <div className="modalBody compact">

          <div className="editorGrid">

            <section className="editorPane">

              <h3>Ürün Bilgileri</h3>

              <div className="two">

                <label>
                  Ürün Adı

                  <input
                    value={product.name}
                    onChange={e=>
                      setProduct({
                        ...product,
                        name:e.target.value
                      })
                    }
                  />
                </label>

                <label>
                  Kategori

                  <select
                    value={product.category}
                    onChange={e=>
                      setProduct({
                        ...product,
                        category:e.target.value
                      })
                    }
                  >
                    <option>Yazlık</option>
                    <option>Kışlık</option>
                  </select>
                </label>

              </div>

              <div className="two qualityRow">
                <label>
                  İş Kalitesi
                  <input
                    placeholder="Örn: A1 / 1. kalite / LUX"
                    value={product.quality || ""}
                    onChange={e=>setProduct({...product,quality:e.target.value})}
                  />
                </label>

                <label>
                  Taban
                  <input
                    placeholder="Örn: Eva taban / Kauçuk"
                    value={product.sole || ""}
                    onChange={e=>setProduct({...product,sole:e.target.value})}
                  />
                </label>
              </div>

              <label>
                Açıklama
                <textarea
                  value={product.description || ""}
                  onChange={e=>setProduct({...product,description:e.target.value})}
                />
              </label>

              <h3>Ürün Sayfası İçerikleri</h3>

              <label>
                Ürün Özellikleri
                <textarea
                  placeholder="Örn: Hakiki deri, yumuşak iç astar, günlük kullanım..."
                  value={product.features || ""}
                  onChange={e=>setProduct({...product,features:e.target.value})}
                />
              </label>

              <label>
                Ürün Ölçüleri / Kalıp Bilgisi
                <textarea
                  placeholder="Örn: Tam kalıp. 37 numara iç uzunluk..."
                  value={product.measurements || ""}
                  onChange={e=>setProduct({...product,measurements:e.target.value})}
                />
              </label>

              <label>
                Ödeme Seçenekleri Metni
                <textarea
                  placeholder="Kart, Havale/EFT vb. açıklama"
                  value={product.paymentInfo || ""}
                  onChange={e=>setProduct({...product,paymentInfo:e.target.value})}
                />
              </label>

              <label>
                Kargo, Değişim ve İade Metni
                <textarea
                  placeholder="Aras Kargo, iade/değişim koşulları..."
                  value={product.shippingReturns || ""}
                  onChange={e=>setProduct({...product,shippingReturns:e.target.value})}
                />
              </label>

              <label>
                S.S.S.
                <textarea
                  placeholder="Sık sorulan sorular / cevaplar"
                  value={product.faq || ""}
                  onChange={e=>setProduct({...product,faq:e.target.value})}
                />
              </label>

              <h3>Fiyat & Maliyet</h3>

              <div className="costGrid">

                <label>
                  Liste Fiyatı
                  <input
                    type="number"
                    value={product.price}
                    onChange={e=>
                      setProduct({
                        ...product,
                        price:n(e.target.value)
                      })
                    }
                  />
                </label>

                <label>
                  İndirim %
                  <input
                    type="number"
                    value={product.discount}
                    onChange={e=>
                      setProduct({
                        ...product,
                        discount:n(e.target.value)
                      })
                    }
                  />
                </label>

                <label>
                  Alış Fiyatı
                  <input
                    type="number"
                    value={product.purchasePrice}
                    onChange={e=>
                      setProduct({
                        ...product,
                        purchasePrice:n(e.target.value)
                      })
                    }
                  />
                </label>

                <label>
                  KDV %
                  <input
                    type="number"
                    value={product.vatRate}
                    onChange={e=>
                      setProduct({
                        ...product,
                        vatRate:n(e.target.value)
                      })
                    }
                  />
                </label>

                <label>
                  Kargo Maliyeti
                  <input
                    type="number"
                    value={product.shippingCost}
                    onChange={e=>
                      setProduct({
                        ...product,
                        shippingCost:n(e.target.value)
                      })
                    }
                  />
                </label>

                <label>
                  Paketleme
                  <input
                    type="number"
                    value={product.packagingCost}
                    onChange={e=>
                      setProduct({
                        ...product,
                        packagingCost:n(e.target.value)
                      })
                    }
                  />
                </label>

                <label>
                  Diğer Gider
                  <input
                    type="number"
                    value={product.otherCost}
                    onChange={e=>
                      setProduct({
                        ...product,
                        otherCost:n(e.target.value)
                      })
                    }
                  />
                </label>

              </div>

              <div className="costSummary">

                <div>
                  <span>Müşteri Fiyatı</span>
                  <strong>
                    {money(calculated.sale)}
                  </strong>
                </div>

                <div>
                  <span>KDV Tutarı</span>
                  <strong>
                    {money(calculated.vat)}
                  </strong>
                </div>

                <div>
                  <span>Toplam Maliyet</span>
                  <strong>
                    {money(calculated.totalCost)}
                  </strong>
                </div>

                <div
                  className={
                    calculated.profit>=0
                      ? "profit"
                      : "loss"
                  }
                >
                  <span>Brüt Fark</span>
                  <strong>
                    {money(calculated.profit)}
                  </strong>
                </div>

              </div>

            </section>

            <section className="editorPane">

              <div className="variantsTitle">

                <div>
                  <h3>
                    Renk / Fotoğraf / Stok
                  </h3>

                  <p>
                    Space veya Enter → sonraki numara
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addColor}
                >
                  + RENK
                </button>

              </div>

              <div className="colorTabs">

                {(product.colors||[])
                  .map((item,index) => (
                    <button
                      type="button"
                      key={item.id}
                      className={
                        index===activeColorIndex
                          ? "active"
                          : ""
                      }
                      onClick={()=>
                        setActiveColorIndex(index)
                      }
                    >
                      {item.name || `Renk ${index+1}`}
                    </button>
                  ))}

              </div>

              {color && (
                <>

                  <div className="colorTop">

                    <input
                      className="colorNameInput"
                      placeholder="Renk adı"
                      value={color.name}
                      onChange={e=>
                        updateColor(
                          activeColorIndex,
                          {name:e.target.value}
                        )
                      }
                    />

                    <label className="imageButton">
                      + FOTOĞRAF

                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        hidden
                        onChange={e=>
                          chooseImages(
                            e,
                            activeColorIndex
                          )
                        }
                      />
                    </label>

                    {product.colors.length>1 && (
                      <button
                        type="button"
                        className="removeColor"
                        onClick={()=>
                          removeColor(activeColorIndex)
                        }
                      >
                        RENGİ SİL
                      </button>
                    )}

                  </div>

                  <div className="imageStrip">

                    {(color.images||[])
                      .map((image,index) => {
                        const src =
                          image?.data ||
                          image?.url ||
                          image;

                        return (
                          <div
                            className="thumbWrap"
                            key={index}
                          >
                            <img
                              src={
                                src?.startsWith?.("/uploads/")
                                  ? API+src
                                  : src
                              }
                            />

                            <button
                              type="button"
                              onClick={()=>
                                removeImage(
                                  activeColorIndex,
                                  index
                                )
                              }
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}

                    {!(color.images||[]).length && (
                      <div className="imageEmpty">
                        Bu renge fotoğraf eklenmedi.
                      </div>
                    )}

                  </div>

                  <div className="variantStocks">

                    {SIZES.map(
                      (size,index) => (
                        <label key={size}>
                          {size}

                          <input
                            ref={el=>
                              sizeRefs.current[index]=el
                            }
                            type="number"
                            min="0"
                            value={
                              color.sizes?.[size] ?? 0
                            }
                            onKeyDown={e=>
                              handleStockKey(
                                e,
                                index
                              )
                            }
                            onChange={e=>
                              updateColor(
                                activeColorIndex,
                                {
                                  sizes:{
                                    ...color.sizes,
                                    [size]:
                                      Math.max(
                                        0,
                                        n(e.target.value)
                                      )
                                  }
                                }
                              )
                            }
                          />
                        </label>
                      )
                    )}

                  </div>

                </>
              )}

            </section>

          </div>

        </div>

        <div className="modalFooter">

          <button
            type="button"
            onClick={close}
          >
            İPTAL
          </button>

          <button className="saveProduct">
            KAYDET
          </button>

        </div>

      </form>

    </div>
  );
}

function OrderModal({
  order,
  close,
  cargoDraft,
  setCargoDraft,
  changeStatus,
  revertOrder
}) {
  return (
    <div
      className="modalShade"
      onMouseDown={e=>{
        if(e.target===e.currentTarget) close();
      }}
    >

      <div
        className="orderModal orderModalPro"
        onMouseDown={e=>e.stopPropagation()}
      >

        <div className="modalHeader">

          <div>
            <small>{order.orderNo}</small>
            <h2>Sipariş Detayı</h2>
          </div>

          <button onClick={close}>
            ×
          </button>

        </div>

        <div className="orderModalBody">

          <section>
            <h3>Müşteri</h3>

            <div className="detailGrid">

              <span>
                Ad Soyad
                <b>{order.customer.name}</b>
              </span>

              <span>
                Telefon
                <b>{order.customer.phone}</b>
              </span>

              <span>
                E-posta
                <b>{order.customer.email}</b>
              </span>

              <span>
                Kaynak
                <b>
                  {order.source || "SHELIVA Web"}
                </b>
              </span>

              <span>
                İl / İlçe
                <b>
                  {order.customer.city}
                  {" / "}
                  {order.customer.district}
                </b>
              </span>

              <span>
                Mahalle
                <b>
                  {order.customer.neighborhood || "-"}
                </b>
              </span>

              <span className="wide">
                Adres
                <b>{order.customer.address}</b>
              </span>

              <span>
                Posta Kodu
                <b>
                  {order.customer.postalCode || "-"}
                </b>
              </span>

            </div>
          </section>

          <section>

            <h3>Ürünler</h3>

            {(order.items||[])
              .map(item => (
                <div className="orderLine productionOrderLine" key={item.key}>
  <div className="orderProductPhoto">
    {item.image ? (
      <img
        src={
          item.image.startsWith("/uploads/")
            ? API+item.image
            : item.image
        }
      />
    ) : (
      <span>FOTOĞRAF</span>
    )}
  </div>

  <div className="productionInfo">
    <div>
      <small>İŞ KALİTESİ</small>
      <b>{item.quality || "-"}</b>
    </div>
    <div>
      <small>RENK</small>
      <b>{item.colorName || "-"}</b>
    </div>
    <div>
      <small>SİPARİŞ TARİHİ</small>
      <b>{new Date(order.createdAt).toLocaleString("tr-TR")}</b>
    </div>
    <div>
      <small>ADET</small>
      <b>{item.qty} ÇİFT</b>
    </div>
    <div>
      <small>TABANI</small>
      <b>{item.sole || "-"}</b>
    </div>
    <div>
      <small>NUMARASI</small>
      <b>{item.size}</b>
    </div>
  </div>

  <strong className="productionPrice">
    {money(item.price*item.qty)}
  </strong>
</div>
              ))}

          </section>

          <section>

            <h3>Ödeme</h3>

            <div className="detailGrid">

              <span>
                Ödeme Yöntemi
                <b>{order.paymentMethod}</b>
              </span>

              <span>
                Durum
                <b>{order.paymentStatus}</b>
              </span>

              <span>
                Ara Toplam
                <b>{money(order.subtotal)}</b>
              </span>

              <span>
                Kargo
                <b>{money(order.cargoFee)}</b>
              </span>

              <span>
                Genel Toplam
                <b>{money(order.total)}</b>
              </span>

            </div>

          </section>

          {order.status==="Hazırlanıyor" && (
            <section>

              <h3>Kargo Çıkışı</h3>

              <div className="cargoForm">

                <select
                  value={cargoDraft.company}
                  onChange={e=>
                    setCargoDraft({
                      ...cargoDraft,
                      company:e.target.value
                    })
                  }
                >
                  <option>Aras Kargo</option>
                  <option>Yurtiçi Kargo</option>
                  <option>MNG Kargo</option>
                  <option>Sürat Kargo</option>
                  <option>PTT Kargo</option>
                  <option>Diğer</option>
                </select>

                <input
                  placeholder="Takip kodu"
                  value={cargoDraft.tracking}
                  onChange={e=>
                    setCargoDraft({
                      ...cargoDraft,
                      tracking:e.target.value
                    })
                  }
                />

                <input
                  placeholder="Kargo notu"
                  value={cargoDraft.note}
                  onChange={e=>
                    setCargoDraft({
                      ...cargoDraft,
                      note:e.target.value
                    })
                  }
                />

              </div>

            </section>
          )}

          {order.status==="Kargoya Verildi" && (
            <section>

              <h3>Kargo</h3>

              <div className="detailGrid">

                <span>
                  Firma
                  <b>{order.cargoCompany}</b>
                </span>

                <span>
                  Takip Kodu
                  <b>{order.cargoTracking}</b>
                </span>

              </div>

            </section>
          )}

        </div>

        <div className="orderModalFooter">

          {["Hazırlanıyor","Kargoya Verildi","Teslim Edildi"].includes(order.status) && (
            <button className="backStatusButton" onClick={()=>revertOrder(order)}>← GERİ AL</button>
          )}

          {order.status==="Yeni" && (
            <button
              onClick={()=>
                changeStatus(
                  order,
                  "Hazırlanıyor"
                )
              }
            >
              ÖDEMEYİ ONAYLA VE HAZIRLA
            </button>
          )}

          {order.status==="Hazırlanıyor" && (
            <button
              onClick={()=>
                changeStatus(
                  order,
                  "Kargoya Verildi",
                  {
                    cargoCompany:
                      cargoDraft.company,

                    cargoTracking:
                      cargoDraft.tracking,

                    cargoNote:
                      cargoDraft.note
                  }
                )
              }
            >
              KARGOYA VER
            </button>
          )}

          {order.status==="Kargoya Verildi" && (
            <button
              onClick={()=>
                changeStatus(
                  order,
                  "Teslim Edildi"
                )
              }
            >
              TESLİM EDİLDİ
            </button>
          )}

        </div>

      </div>

    </div>
  );
}


function ReportRank({title,data=[]}) {
  return (
    <div className="reportRank">
      <h3>{title}</h3>
      {!data?.length && <p className="rankEmpty">Henüz yeterli veri yok.</p>}
      {(data || []).map((item,index)=>(
        <div className="rankRow" key={item.name}>
          <span>{index+1}. {item.name}</span>
          <b>{item.value}</b>
        </div>
      ))}
    </div>
  );
}