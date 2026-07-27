import { useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import "./App.css";

const API = "http://localhost:3001";
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
      company:"Yurtiçi Kargo",
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
        if(tt.ok)setTickets(await tt.json()); if(rr.ok)setReturns(await rr.json()); if(ss.ok)setSettings(await ss.json()); if(mm.ok)setMetrics(await mm.json());
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
                r => !r.approved
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

            <div className="netProfitBar"><span>Toplam Net Kâr</span><strong>{money(metrics.netProfit||0)}</strong></div>
          <section className="finance">

              <div className="financeCard revenue">
                <span>Toplam Ciro</span>
                <strong>
                  {money(revenue)}
                </strong>
              </div>

              <div className="financeCard sales">
                <span>Toplam Satış</span>
                <strong>
                  {money(completedSales)}
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

                  <div className="stockProductTitle">
                    <div>
                      <h3>{product.name}</h3>
                      <span>{product.code}</span>
                    </div>

                    <strong>
                      {totalStock(product)} adet
                    </strong>
                  </div>

                  {(product.colors||[])
                    .map(color => (
                      <div
                        className="stockColor"
                        key={color.id}
                      >
                        <b>{color.name}</b>

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

        {[
          "reviews",
          "returns",
          "reports",
          "settings"
        ].includes(page) && (
          <section className="pageCard">
            <div className="emptyPage">
              Bu bölüm sonraki aşamada geliştirilecek.
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
    <div className="modalShade">

      <form
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

              <label>
                Açıklama

                <textarea
                  value={
                    product.description || ""
                  }
                  onChange={e=>
                    setProduct({
                      ...product,
                      description:e.target.value
                    })
                  }
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
  changeStatus
}) {
  return (
    <div className="modalShade">

      <div className="orderModal">

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
                <div
                  className="orderLine"
                  key={item.key}
                >
                  <div>
                    <b>{item.name}</b>
                    <span>
                      {item.colorName}
                      {" • "}
                      {item.size}
                      {" • "}
                      {item.qty} adet
                    </span>
                  </div>

                  <strong>
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
                  <option>Yurtiçi Kargo</option>
                  <option>Aras Kargo</option>
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

          {order.status==="Yeni" && (
            <button
              onClick={()=>
                changeStatus(
                  order,
                  "Hazırlanıyor"
                )
              }
            >
              HAZIRLAMAYA AL
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

